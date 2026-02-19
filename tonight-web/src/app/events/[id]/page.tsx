import { notFound } from "next/navigation";

import { JoinRequestStatus } from "@/generated/prisma/client";
import { EventInsideExperience, type EventInsideExperienceProps } from "@/components/tonight/event-inside/EventInsideExperience";
import type { MobileActionBarProps } from "@/components/tonight/MobileActionBar";
import { fetchEventById } from "@/lib/events";
import { listJoinRequestsForEvent, type SerializedJoinRequestWithUser } from "@/lib/join-requests";
import { prisma } from "@/lib/prisma";
import { getCurrentUser } from "@/middleware/auth";
import { EventInsidePageClient } from "./EventInsidePageClient";

interface PageParams {
  params: Promise<{
    id?: string | string[];
  }>;
}

const HOST_UNREAD_THREAD_LIMIT = 3;
const HOST_ACTIVITY_FEED_LIMIT = 3;
const CHAT_PREVIEW_MESSAGE_LIMIT = 3;
const HOST_FRIEND_INVITE_LIMIT = 6;
const HOST_FRIEND_INVITE_COOLDOWN_MS = 15 * 60 * 1000;

type HostUnreadThreadSummary = {
  joinRequestId: string;
  displayName: string;
  lastMessageSnippet: string;
  lastMessageAtISO: string | null;
  unreadCount: number | null;
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

  const filtered: HostUnreadThreadSummary[] = [];
  for (const entry of summaries) {
    if (entry !== null) {
      filtered.push(entry);
    }
  }
  return filtered;
};


const buildHostRecentThreadSummaries = async ({
  eventId,
  hostId,
}: {
  eventId: string;
  hostId: string;
}): Promise<HostUnreadThreadSummary[]> => {
  const recentMessages = await prisma.message.findMany({
    where: {
      joinRequest: {
        eventId,
        status: JoinRequestStatus.ACCEPTED,
      },
      senderId: {
        not: hostId,
      },
    },
    orderBy: {
      createdAt: "desc",
    },
    take: HOST_UNREAD_THREAD_LIMIT * 4,
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

  if (!recentMessages.length) {
    return [];
  }

  const seen = new Set<string>();
  const summaries: HostUnreadThreadSummary[] = [];

  for (const message of recentMessages) {
    if (!message.joinRequestId || seen.has(message.joinRequestId)) {
      continue;
    }

    seen.add(message.joinRequestId);
    const displayName =
      message.joinRequest?.user.displayName ?? message.joinRequest?.user.email ?? "Guest";

    summaries.push({
      joinRequestId: message.joinRequestId,
      displayName,
      lastMessageSnippet: message.content,
      lastMessageAtISO: message.createdAt?.toISOString() ?? null,
      unreadCount: null,
    });

    if (summaries.length >= HOST_UNREAD_THREAD_LIMIT) {
      break;
    }
  }

  return summaries;
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

  if (!suggestions.length) {
    return [];
  }

  const joinRequestIds = suggestions.map((entry) => entry.joinRequestId);
  const inviteeUserIds = suggestions.map((entry) => entry.userId);

  const [hostMessages, eventInviteLogs] = await Promise.all([
    prisma.message.findMany({
      where: {
        joinRequestId: { in: joinRequestIds },
        senderId: hostId,
      },
      orderBy: {
        createdAt: "desc",
      },
      select: {
        joinRequestId: true,
        createdAt: true,
      },
    }),
    prisma.eventInviteLog.findMany({
      where: {
        eventId: currentEventId,
        inviteeId: { in: inviteeUserIds },
      },
      orderBy: { invitedAt: "desc" },
      select: {
        inviteeId: true,
        invitedAt: true,
      },
    }),
  ]);

  const lastInviteMap = new Map<string, Date>();
  for (const message of hostMessages) {
    if (!lastInviteMap.has(message.joinRequestId)) {
      lastInviteMap.set(message.joinRequestId, message.createdAt);
    }
  }

  const currentEventInviteMap = new Map<string, Date>();
  for (const invite of eventInviteLogs) {
    const existing = currentEventInviteMap.get(invite.inviteeId);
    if (!existing || (invite.invitedAt && invite.invitedAt > existing)) {
      currentEventInviteMap.set(invite.inviteeId, invite.invitedAt);
    }
  }

  return suggestions.map((entry) => {
    const lastInviteAt = lastInviteMap.get(entry.joinRequestId);
    const nextInviteAvailableAt = lastInviteAt
      ? new Date(lastInviteAt.getTime() + HOST_FRIEND_INVITE_COOLDOWN_MS)
      : null;
    const currentEventInviteAt = currentEventInviteMap.get(entry.userId);

    return {
      ...entry,
      lastInviteAtISO: lastInviteAt?.toISOString() ?? null,
      nextInviteAvailableAtISO: nextInviteAvailableAt?.toISOString() ?? null,
      currentEventInviteAtISO: currentEventInviteAt?.toISOString() ?? null,
    };
  });
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
  const [recentMessages, unreadCount, acceptedGuestsCount, latestHostMessages] = await Promise.all([
    prisma.message.findMany({
      where: { joinRequestId },
      orderBy: { createdAt: "desc" },
      take: CHAT_PREVIEW_MESSAGE_LIMIT,
      select: {
        id: true,
        content: true,
        createdAt: true,
        senderId: true,
        sender: {
          select: {
            displayName: true,
            email: true,
            photoUrl: true,
          },
        },
      },
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

  const lastMessage = recentMessages[0];
  const lastMessageSnippet = lastMessage?.content ?? "No messages yet. Say hi once you're accepted.";
  const lastMessageAuthorName = lastMessage
    ? lastMessage.senderId === viewerId
      ? "You"
      : lastMessage.sender?.displayName ?? lastMessage.sender?.email ?? "Guest"
    : null;
  const lastMessageAtISO = lastMessage?.createdAt?.toISOString() ?? fallbackTimestampISO ?? null;
  const participantCount = acceptedGuestsCount + 1; // host + accepted guests
  const hostActivityFeed = trimmedHostMessages.map((message) => ({
    id: message.id,
    message: message.content,
    postedAtISO: message.createdAt?.toISOString() ?? null,
    authorName: hostDisplayName ?? "Host",
  }));

  const guestMessagePreview = recentMessages.map((message) => ({
    id: message.id,
    content: message.content,
    postedAtISO: message.createdAt?.toISOString() ?? null,
    authorName: message.senderId === viewerId
      ? "You"
      : message.sender?.displayName ?? message.sender?.email ?? "Guest",
    authorAvatarUrl: message.sender?.photoUrl ?? null,
    isViewer: message.senderId === viewerId,
  }));

  return {
    lastMessageSnippet,
    lastMessageAuthorName,
    lastMessageAtISO,
    unreadCount: unreadCount > 0 ? unreadCount : null,
    participantCount,
    ctaLabel: "Open chat",
    ctaHref: `/chat/${joinRequestId}`,
    guestComposer: {
      joinRequestId,
    },
    guestMessagePreview: guestMessagePreview.length ? guestMessagePreview.reverse() : undefined,
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

  const lastGuestAuthorName = latestGuestMessage
    ? latestGuestMessage.joinRequest?.user.displayName ?? latestGuestMessage.joinRequest?.user.email ?? "Guest"
    : null;

  let hostRecentThreads: HostUnreadThreadSummary[] = [];
  if (hostUnreadThreads.length === 0) {
    hostRecentThreads = await buildHostRecentThreadSummaries({
      eventId,
      hostId,
    });
  }

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
      hostRecentThreads: hostUnreadThreads.length === 0 && hostRecentThreads.length ? hostRecentThreads : undefined,
    };
  }

  return {
    participantCount,
    lastMessageSnippet: latestGuestMessage.content,
    lastMessageAuthorName: lastGuestAuthorName ?? "Guest",
    lastMessageAtISO: latestGuestMessage.createdAt.toISOString(),
    unreadCount: unreadCount > 0 ? unreadCount : null,
    ctaLabel: unreadCount > 0 ? "Reply to guests" : "Open latest chat",
    ctaHref: "/chat/" + latestGuestMessage.joinRequestId,
    hostUnreadThreads: hostUnreadThreads.length ? hostUnreadThreads : undefined,
    hostRecentThreads: hostUnreadThreads.length === 0 && hostRecentThreads.length ? hostRecentThreads : undefined,
  };
};



export default async function EventInsidePage({ params }: PageParams) {
  const resolvedParams = await params;
  const eventId = normalizeEventId(resolvedParams?.id);
  if (!eventId) {
    notFound();
  }

  const auth = await getCurrentUser();
  const authenticatedUser = auth ? (auth as NonNullable<typeof auth>) : null;

  // Fetch current user's profile data for header display
  let currentUserProfile: { displayName: string | null; email: string; photoUrl: string | null; } | null = null;
  if (authenticatedUser) {
    const userRecord = await prisma.user.findUnique({
      where: { id: authenticatedUser.userId },
      select: { displayName: true, email: true, photoUrl: true },
    });
    if (userRecord) {
      currentUserProfile = userRecord;
    }
  }

  const eventRecord = await fetchEventById(eventId);
  if (!eventRecord) {
    notFound();
  }

  const isHostViewer = authenticatedUser ? eventRecord.hostId === authenticatedUser.userId : false;

  // Only fetch join requests if the user is authenticated AND is the host
  // Public viewers and guests don't need join request data
  let joinRequests: SerializedJoinRequestWithUser[] = [];
  if (authenticatedUser && isHostViewer) {
    try {
      joinRequests = await listJoinRequestsForEvent({
        eventId,
        hostId: eventRecord.hostId,
      });
    } catch (error) {
      console.error("Unable to load join requests for event", eventId, error);
    }
  }

  // For non-host authenticated users, check if they have a join request
  let viewerJoinRequest: SerializedJoinRequestWithUser | undefined;
  if (authenticatedUser && !isHostViewer) {
    const viewerRequest = await prisma.joinRequest.findFirst({
      where: {
        eventId,
        userId: authenticatedUser.userId,
      },
      select: {
        id: true,
        status: true,
        createdAt: true,
        updatedAt: true,
        lastSeenHostActivityAt: true,
        user: {
          select: {
            id: true,
            email: true,
            displayName: true,
            photoUrl: true,
            createdAt: true,
          },
        },
      },
    });

    if (viewerRequest) {
      viewerJoinRequest = {
        id: viewerRequest.id,
        eventId: eventId,
        userId: authenticatedUser.userId,
        status: viewerRequest.status,
        createdAt: viewerRequest.createdAt.toISOString(),
        updatedAt: viewerRequest.updatedAt.toISOString(),
        lastSeenHostActivityAt: viewerRequest.lastSeenHostActivityAt?.toISOString() ?? null,
        user: {
          id: viewerRequest.user.id,
          email: viewerRequest.user.email,
          displayName: viewerRequest.user.displayName,
          photoUrl: viewerRequest.user.photoUrl,
          createdAt: viewerRequest.user.createdAt.toISOString(),
        },
      };
    }
  }

  const attendees = mapJoinRequestsToAttendees(joinRequests);
  const pendingRequests = isHostViewer ? mapPendingJoinRequests(joinRequests) : [];
  const attendeeUserIds = attendees.map((attendee) => attendee.id);

  const hostChatParticipants = isHostViewer
    ? joinRequests
        .filter((request) => request.status === JoinRequestStatus.ACCEPTED)
        .map((request) => ({
          joinRequestId: request.id,
          userId: request.user.id,
          displayName: request.user.displayName ?? request.user.email ?? "Guest",
          avatarUrl: request.user.photoUrl,
        }))
    : undefined;

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
      : viewerJoinRequest?.status === JoinRequestStatus.PENDING
        ? "pending"
        : "public";

  let chatPreview: EventInsideExperienceProps["chatPreview"] | undefined;
  if (authenticatedUser) {
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
    } else if (viewerRole === "public") {
      // Authenticated users who haven't requested to join yet
      chatPreview = {
        ctaLabel: "Request to join event",
        ctaDisabledReason: "Send a join request to chat with the host and other guests.",
      };
    }
  } else {
    // Unauthenticated users see a login prompt
    chatPreview = {
      ctaLabel: "Login to join event",
      ctaDisabledReason: "You must be logged in to request to join this event.",
    };
  }

  const experience: EventInsideExperienceProps = {
    event: {
      id: eventRecord.id,
      title: eventRecord.title,
      description: eventRecord.description,
      startDateISO: eventRecord.datetime.toISOString(),
      locationName: eventRecord.locationName,
      location: eventRecord.latitude && eventRecord.longitude
        ? {
            latitude: typeof eventRecord.latitude === 'string' ? parseFloat(eventRecord.latitude) : eventRecord.latitude,
            longitude: typeof eventRecord.longitude === 'string' ? parseFloat(eventRecord.longitude) : eventRecord.longitude,
          }
        : null,
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
    hostChatParticipants,
    socketToken: authenticatedUser?.token,
    pendingJoinRequestId: viewerRole === "pending" && viewerJoinRequest ? viewerJoinRequest.id : null,
    viewerUser:
      authenticatedUser && currentUserProfile
        ? {
            id: authenticatedUser.userId,
            displayName: currentUserProfile.displayName ?? null,
            email: currentUserProfile.email,
            photoUrl: currentUserProfile.photoUrl ?? null,
          }
        : null,
  };

  if (authenticatedUser && currentUserProfile) {
    return (
      <EventInsidePageClient
        experience={experience}
        layoutProps={{
          eventTitle: eventRecord.title,
          eventLocation: eventRecord.locationName,
          userDisplayName: currentUserProfile.displayName,
          userEmail: currentUserProfile.email,
          userPhotoUrl: currentUserProfile.photoUrl,
        }}
      />
    );
  }

  const content = (
    <div className="mx-auto flex w-full max-w-6xl flex-col gap-6">
      <EventInsideExperience {...experience} />
      <p className="text-center text-xs text-white/60">
        Built on live event + join-request data. Next: explore inline host reply shortcuts.
      </p>
    </div>
  );

  return (
    <div className="mx-auto flex w-full max-w-6xl flex-col gap-6 px-4 py-10 sm:px-6 lg:px-0">
      {content}
    </div>
  );
}
