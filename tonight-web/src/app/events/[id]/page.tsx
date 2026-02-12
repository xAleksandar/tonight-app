import { notFound, redirect } from "next/navigation";

import { EventInsideExperience, type EventInsideExperienceProps } from "@/components/tonight/event-inside/EventInsideExperience";
import { fetchEventById } from "@/lib/events";
import { listJoinRequestsForEvent, type SerializedJoinRequestWithUser } from "@/lib/join-requests";
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
      request.status === "ACCEPTED"
        ? "confirmed"
        : request.status === "PENDING"
          ? "pending"
          : "waitlist",
    blurb:
      request.status === "PENDING"
        ? "Waiting on host review"
        : request.status === "ACCEPTED"
          ? "Coming tonight"
          : "Moved to waitlist",
  }));
};

const mapPendingJoinRequests = (
  requests: SerializedJoinRequestWithUser[]
): EventInsideExperienceProps["joinRequests"] => {
  return requests
    .filter((request) => request.status === "PENDING")
    .map((request) => ({
      id: request.id,
      displayName: request.user.displayName ?? request.user.email,
      intro: null,
      submittedAtISO: request.createdAt,
      mutualFriends: null,
    }));
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

  if (eventRecord.hostId !== authenticatedUser.userId) {
    notFound();
  }

  let joinRequests: SerializedJoinRequestWithUser[] = [];
  try {
    joinRequests = await listJoinRequestsForEvent({
      eventId,
      hostId: authenticatedUser.userId,
    });
  } catch (error) {
    console.error("Unable to load join requests for event", eventId, error);
  }

  const attendees = mapJoinRequestsToAttendees(joinRequests);
  const pendingRequests = mapPendingJoinRequests(joinRequests);

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
    viewerRole: "host",
    chatPreview: undefined,
  };

  return (
    <div className="mx-auto flex w-full max-w-6xl flex-col gap-6 px-4 py-10 sm:px-6 lg:px-0">
      <EventInsideExperience {...experience} />
      <p className="text-center text-xs text-white/60">
        Built on live event + join-request data. Next: wire actions + chat.
      </p>
    </div>
  );
}
