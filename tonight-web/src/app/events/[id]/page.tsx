import { notFound, redirect } from "next/navigation";

import { JoinRequestStatus } from "@/generated/prisma/client";
import { EventInsideExperience, type EventInsideExperienceProps } from "@/components/tonight/event-inside/EventInsideExperience";
import { fetchEventById } from "@/lib/events";
import { listJoinRequestsForEvent, type SerializedJoinRequestWithUser } from "@/lib/join-requests";
import { prisma } from "@/lib/prisma";
import { getCurrentUser } from "@/middleware/auth";

interface PageParams {
  params?: {
    id?: string | string[];
  };
}

const HOST_UNREAD_THREAD_LIMIT = 3;
const HOST_ACTIVITY_FEED_LIMIT = 3;
const HOST_FRIEND_INVITE_LIMIT = 6;

type HostUnreadThreadSummary = {
  joinRequestId: string;
  displayName: string;
  lastMessageSnippet: string;
  lastMessageAtISO?: string | null;
  unreadCount?: number | null;
};

const normalizeEventId = (value: string | string[] | undefined) => {
  if (typeof value === "string") {
    return value.trim();
  }

  if (Array.isArray(value)) {
    return value[0]?.trim() ?? "";
  }

  return "";
};

const mapJoinRequestsToAttendees = (
  requests: SerializedJoinRequestWithUser[]
): EventInsideExperienceProps["attendees"] => {
  return requests.map((request) => ({
    id: request.user.id,
    displayName: request.user.displayName ?? request.user.email,
    avatarUrl: request.user.photoUrl,
    status:
      request.status === JoinRequestStatus.ACCEPTED
        ? "confirmed"
        : request.status === JoinRequestStatus.PENDING
          ? "pending"
          : "waitlist",
    blurb:
      request.status === JoinRequestStatus.PENDING
        ? "Waiting on host review"
        : request.status === JoinRequestStatus.ACCEPTED
          ? "Coming tonight"
          : "Moved to waitlist",
  }));
};

const mapPendingJoinRequests = (
  requests: SerializedJoinRequestWithUser[]
): EventInsideExperienceProps["joinRequests"] => {
  return requests
    .filter((request) => request.status === JoinRequestStatus.PENDING)
    .map((request) => ({
      id: request.id,
      userId: request.user.id,
      displayName: request.user.displayName ?? request.user.email,
      intro: null,
      submittedAtISO: request.createdAt,
      mutualFriends: null,
    }));
};

const buildHostUnreadThreadSummaries = async ({
  eventId,
  hostId,
}: {
  eventId: string;
  hostId: string;
}): Promise<HostUnreadThreadSummary[]> => {
  const unreadThreadGroups = await prisma.message.groupBy({
    where: {
      joinRequest: {
        eventId,
        status: JoinRequestStatus.ACCEPTED,
      },
      senderId: {
        not: hostId,
      },
      readBy: {
        none: {
          userId: hostId,
        },
      },
    },
    by: ["joinRequestId"],
    _count: {
      _all: true,
    },
    _max: {
      createdAt: true,
    },
    orderBy: {
      _max: {
        createdAt: "desc",
      },
    },
    take: HOST_UNREAD_THREAD_LIMIT,
  });

  if (unreadThreadGroups.length === 0) {
    return [];
  }

  const summaries = await Promise.all(
    unreadThreadGroups.map(async (thread) => {
      const latestUnreadMessage = await prisma.message.findFirst({
        where: {
          joinRequestId: thread.joinRequestId,
          senderId: {
            not: hostId,
          },
          readBy: {
            none: {
              userId: hostId,
            },
          },
        },
        orderBy: { createdAt: "desc" },
        select: {
          content: true,
          createdAt: true,
          joinRequestId: true,
          joinRequest: {
            select: {
              user: {
                select: {
                  displayName: true,
                  email: true,
                },
              },
            },
          },
        },
      });

      if (!latestUnreadMessage) {
        return null;
      }

      const displayName =
        latestUnreadMessage.joinRequest.user.displayName ?? latestUnreadMessage.joinRequest.user.email ?? "Guest";

      return {
        joinRequestId: thread.joinRequestId,
        displayName,
        lastMessageSnippet: latestUnreadMessage.content,
        lastMessageAtISO: latestUnreadMessage.createdAt?.toISOString() ?? null,
        unreadCount: thread._count._all > 0 ? thread._count._all : null,
      } satisfies HostUnreadThreadSummary;
    })
  );

  return summaries.filter((entry): entry is HostUnreadThreadSummary => Boolean(entry));
};

const buildHostFriendInviteCandidates = async ({
  hostId,
  currentEventId,
  excludeUserIds,
}: {
  hostId: string;
  currentEventId: string;
  excludeUserIds: string[];
}): Promise<EventInsideExperienceProps["hostFriendInvites"]> => {
  const recentGuests = await prisma.joinRequest.findMany({
    where: {
      status: JoinRequestStatus.ACCEPTED,
      userId: excludeUserIds.length ? { notIn: excludeUserIds } : undefined,
      event: {
        hostId,
        id: {
          not: currentEventId,
        },
      },
    },
    orderBy: {
      updatedAt: "desc",
    },
    take: HOST_FRIEND_INVITE_LIMIT * 4,
    select: {
      id: true,
      userId: true,
      updatedAt: true,
      user: {
        select: {
          displayName: true,
          email: true,
          photoUrl: true,
        },
      },
      event: {
        select: {
          title: true,
        },
      },
    },
  });

  if (!recentGuests.length) {
    return [];
  }

  const seenUsers = new Set<string>();
  const suggestions: NonNullable<EventInsideExperienceProps["hostFriendInvites"]> = [];

  for (const request of recentGuests) {
    if (seenUsers.has(request.userId)) {
      continue;
    }
    seenUsers.add(request.userId);
    suggestions.push({
      joinRequestId: request.id,
      userId: request.userId,
      displayName: request.user.displayName ?? request.user.email ?? "Guest",
      avatarUrl: request.user.photoUrl,
      lastEventTitle: request.event.title,
      lastInteractionAtISO: request.updatedAt?.toISOString() ?? null,
    });

    if (suggestions.length >= HOST_FRIEND_INVITE_LIMIT) {
      break;
    }
  }

  return suggestions;
};

const buildChatPreviewForAcceptedGuest = async ({
  joinRequestId,
  viewerId,
  eventId,
  hostId,
  hostDisplayName,
  fallbackTimestampISO,
  lastSeenHostActivityAt,
}: {
  joinRequestId: string;
  viewerId: string;
  eventId: string;
  hostId: string;
  hostDisplayName?: string | null;
  fallbackTimestampISO?: string;
  lastSeenHostActivityAt?: string | null;
}): Promise<EventInsideExperienceProps["chatPreview"]> => {
  const [lastMessage, unreadCount, acceptedGuestsCount, latestHostMessages] = await Promise.all([
    prisma.message.findFirst({
      where: { joinRequestId },
      orderBy: { createdAt: "desc" },
      select: { content: true, createdAt: true },
    }),
    prisma.message.count({
      where: {
        joinRequestId,
        senderId: { not: viewerId },
        readBy: {
          none: {
            userId: viewerId,
          },
        },
      },
    }),
    prisma.joinRequest.count({
      where: {
        eventId,
        status: JoinRequestStatus.ACCEPTED,
      },
    }),
    prisma.message.findMany({
      where: {
        joinRequestId,
        senderId: hostId,
      },
      orderBy: { createdAt: "desc" },
      take: HOST_ACTIVITY_FEED_LIMIT + 1,
      select: { id: true, content: true, createdAt: true },
    }),
  ]);

  const hostActivityHasMore = latestHostMessages.length > HOST_ACTIVITY_FEED_LIMIT;
  const hostActivityCursorSource = hostActivityHasMore ? latestHostMessages[HOST_ACTIVITY_FEED_LIMIT] : undefined;
  const trimmedHostMessages = hostActivityHasMore ? latestHostMessages.slice(0, HOST_ACTIVITY_FEED_LIMIT) : latestHostMessages;

  const lastMessageSnippet = lastMessage?.content ?? "No messages yet. Say hi once you're accepted.";
  const lastMessageAtISO = lastMessage?.createdAt.toISOString() ?? fallbackTimestampISO ?? null;
  const participantCount = acceptedGuestsCount + 1; // host + accepted guests
  const hostActivityFeed = trimmedHostMessages.map((message) => ({
    id: message.id,
    message: message.content,
    postedAtISO: message.createdAt?.toISOString() ?? null,
    authorName: hostDisplayName ?? "Host",
  }));

  return {
    lastMessageSnippet,
    lastMessageAtISO,
    unreadCount: unreadCount > 0 ? unreadCount : null,
    participantCount,
    ctaLabel: "Open chat",
    ctaHref: `/chat/${joinRequestId}`,
    guestComposer: {
      joinRequestId,
    },
    latestHostActivity: hostActivityFeed[0],
    latestHostActivityFeed: hostActivityFeed.length ? hostActivityFeed : undefined,
    hostActivityFeedPagination:
      hostActivityFeed.length || hostActivityHasMore
        ? {
            hasMore: hostActivityHasMore,
            nextCursor: hostActivityCursorSource?.createdAt ? hostActivityCursorSource.createdAt.toISOString() : null,
          }
        : undefined,
    hostActivityLastSeenAt: lastSeenHostActivityAt ?? null,
  };
};

const buildChatPreviewForPendingViewer = (status: JoinRequestStatus | undefined): EventInsideExperienceProps["chatPreview"] => {
  if (status === JoinRequestStatus.PENDING) {
    return {
      ctaLabel: "Waiting for host approval",
      ctaDisabledReason: "Chat unlocks once the host approves your request.",
    };
  }

  return {
    ctaLabel: "Chat unavailable",
    ctaDisabledReason: "Chat is only available to accepted guests.",
  };
};

const buildChatPreviewForHost = async ({
  eventId,
  hostId,
}: {
  eventId: string;
  hostId: string;
}): Promise<EventInsideExperienceProps["chatPreview"]> => {
  const [latestGuestMessage, unreadCount, acceptedGuestCount, hostUnreadThreads] = await Promise.all([
    prisma.message.findFirst({
      where: {
        joinRequest: {
          eventId,
          status: JoinRequestStatus.ACCEPTED,
        },
        senderId: {
          not: hostId,
        },
      },
      orderBy: { createdAt: "desc" },
      select: {
        content: true,
        createdAt: true,
        joinRequestId: true,
      },
    }),
    prisma.message.count({
      where: {
        joinRequest: {
          eventId,
          status: JoinRequestStatus.ACCEPTED,
        },
        senderId: {
          not: hostId,
        },
        readBy: {
          none: {
            userId: hostId,
          },
        },
      },
    }),
    prisma.joinRequest.count({
      where: {
        eventId,
        status: JoinRequestStatus.ACCEPTED,
      },
    }),
    buildHostUnreadThreadSummaries({ eventId, hostId }),
  ]);

  const participantCount = acceptedGuestCount > 0 ? acceptedGuestCount + 1 : null;

  if (!acceptedGuestCount) {
    return {
      ctaLabel: "No guest chats yet",
      ctaDisabledReason: "Approve at least one guest to unlock chat.",
    };
  }

  if (!latestGuestMessage) {
    return {
      participantCount,
      lastMessageSnippet: "No guest messages yet. You're caught up.",
      ctaLabel: "Open guest chats",
      ctaDisabledReason: "Guests can message you once they DM the host.",
      hostUnreadThreads: hostUnreadThreads.length ? hostUnreadThreads : undefined,
    };
  }

  return {
    participantCount,
    lastMessageSnippet: latestGuestMessage.content,
    lastMessageAtISO: latestGuestMessage.createdAt.toISOString(),
    unreadCount: unreadCount > 0 ? unreadCount : null,
    ctaLabel: unreadCount > 0 ? "Reply to guests" : "Open latest chat",
    ctaHref: "/chat/" + latestGuestMessage.joinRequestId,
    hostUnreadThreads: hostUnreadThreads.length ? hostUnreadThreads : undefined,
  };
};

export default async function EventInsidePage({ params }: PageParams) {
  const eventId = normalizeEventId(params?.id);
  if (!eventId) {
    notFound();
  }

  const auth = await getCurrentUser();
  if (!auth) {
    const searchParams = new URLSearchParams({ next: `/events/${eventId}` });
    redirect(`/login?${searchParams.toString()}`);
  }

  const authenticatedUser = auth as NonNullable<typeof auth>;

  const eventRecord = await fetchEventById(eventId);
  if (!eventRecord) {
    notFound();
  }

  let joinRequests: SerializedJoinRequestWithUser[] = [];
  try {
    joinRequests = await listJoinRequestsForEvent({
      eventId,
      hostId: eventRecord.hostId,
    });
  } catch (error) {
    console.error("Unable to load join requests for event", eventId, error);
  }

  const isHostViewer = eventRecord.hostId === authenticatedUser.userId;
  const viewerJoinRequest = joinRequests.find((request) => request.user.id === authenticatedUser.userId);

  if (!isHostViewer && !viewerJoinRequest) {
    notFound();
  }

  const attendees = mapJoinRequestsToAttendees(joinRequests);
  const pendingRequests = isHostViewer ? mapPendingJoinRequests(joinRequests) : [];
  const attendeeUserIds = attendees.map((attendee) => attendee.id);

  let hostFriendInvites: EventInsideExperienceProps["hostFriendInvites"];
  if (isHostViewer) {
    hostFriendInvites = await buildHostFriendInviteCandidates({
      hostId: eventRecord.hostId,
      currentEventId: eventRecord.id,
      excludeUserIds: attendeeUserIds,
    });
  }

  const viewerRole: EventInsideExperienceProps["viewerRole"] = isHostViewer
    ? "host"
    : viewerJoinRequest?.status === JoinRequestStatus.ACCEPTED
      ? "guest"
      : "pending";

  let chatPreview: EventInsideExperienceProps["chatPreview"] | undefined;
  if (viewerRole === "host") {
    chatPreview = await buildChatPreviewForHost({
      eventId,
      hostId: eventRecord.hostId,
    });
  } else if (viewerRole === "guest" && viewerJoinRequest) {
    chatPreview = await buildChatPreviewForAcceptedGuest({
      joinRequestId: viewerJoinRequest.id,
      viewerId: authenticatedUser.userId,
      eventId,
      hostId: eventRecord.hostId,
      hostDisplayName: eventRecord.hostDisplayName ?? eventRecord.hostEmail,
      fallbackTimestampISO: viewerJoinRequest.updatedAt,
      lastSeenHostActivityAt: viewerJoinRequest.lastSeenHostActivityAt,
    });
  } else if (viewerRole === "pending") {
    chatPreview = buildChatPreviewForPendingViewer(viewerJoinRequest?.status);
  }

  const experience: EventInsideExperienceProps = {
    event: {
      id: eventRecord.id,
      title: eventRecord.title,
      description: eventRecord.description,
      startDateISO: eventRecord.datetime.toISOString(),
      locationName: eventRecord.locationName,
      capacityLabel: `${eventRecord.maxParticipants} spots`,
    },
    host: {
      id: eventRecord.hostId,
      displayName: eventRecord.hostDisplayName ?? eventRecord.hostEmail,
      email: eventRecord.hostEmail,
      avatarUrl: eventRecord.hostPhotoUrl,
    },
    attendees,
    joinRequests: pendingRequests,
    viewerRole,
    chatPreview,
    hostFriendInvites,
    socketToken: authenticatedUser.token,
  };

  return (
    <div className="mx-auto flex w-full max-w-6xl flex-col gap-6 px-4 py-10 sm:px-6 lg:px-0">
      <EventInsideExperience {...experience} />
      <p className="text-center text-xs text-white/60">
        Built on live event + join-request data. Next: explore inline host reply shortcuts.
      </p>
    </div>
  );
}
