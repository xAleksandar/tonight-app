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

const buildChatPreviewForAcceptedGuest = async ({
  joinRequestId,
  viewerId,
  eventId,
  fallbackTimestampISO,
}: {
  joinRequestId: string;
  viewerId: string;
  eventId: string;
  fallbackTimestampISO?: string;
}): Promise<EventInsideExperienceProps["chatPreview"]> => {
  const [lastMessage, unreadCount, acceptedGuestsCount] = await Promise.all([
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
  ]);

  const lastMessageSnippet = lastMessage?.content ?? "No messages yet. Say hi once you're accepted.";
  const lastMessageAtISO = lastMessage?.createdAt.toISOString() ?? fallbackTimestampISO ?? null;
  const participantCount = acceptedGuestsCount + 1; // host + accepted guests

  return {
    lastMessageSnippet,
    lastMessageAtISO,
    unreadCount: unreadCount > 0 ? unreadCount : null,
    participantCount,
    ctaLabel: "Open chat",
    ctaHref: `/chat/${joinRequestId}`,
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

  const viewerRole: EventInsideExperienceProps["viewerRole"] = isHostViewer
    ? "host"
    : viewerJoinRequest?.status === JoinRequestStatus.ACCEPTED
      ? "guest"
      : "pending";

  let chatPreview: EventInsideExperienceProps["chatPreview"] | undefined;
  if (viewerRole === "guest" && viewerJoinRequest) {
    chatPreview = await buildChatPreviewForAcceptedGuest({
      joinRequestId: viewerJoinRequest.id,
      viewerId: authenticatedUser.userId,
      eventId,
      fallbackTimestampISO: viewerJoinRequest.updatedAt,
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
  };

  return (
    <div className="mx-auto flex w-full max-w-6xl flex-col gap-6 px-4 py-10 sm:px-6 lg:px-0">
      <EventInsideExperience {...experience} />
      <p className="text-center text-xs text-white/60">
        Built on live event + join-request data. Next: surface host chat summaries.
      </p>
    </div>
  );
}
