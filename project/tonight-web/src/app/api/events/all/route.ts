import { NextResponse } from "next/server";
import { JoinRequestStatus } from "@/generated/prisma/client";
import { requireAuth } from "@/middleware/auth";
import { findActiveEventsForMap } from "@/lib/geospatial";
import { createErrorResponse, handleRouteError } from "@/lib/http/errors";

const ROUTE_CONTEXT = "GET /api/events/all";

const buildHostInitials = (value: string | null | undefined) => {
  if (!value) {
    return "YN";
  }
  const trimmed = value.trim();
  if (!trimmed) {
    return "YN";
  }
  const parts = trimmed.split(/\s+/).filter(Boolean);
  if (parts.length === 0) {
    return "YN";
  }
  const initials = parts
    .slice(0, 2)
    .map((segment) => segment.charAt(0).toUpperCase())
    .join("");
  return initials || "YN";
};

const serializeEvent = (event: Awaited<ReturnType<typeof findActiveEventsForMap>>[number]) => {
  const hostInitials = buildHostInitials(event.hostDisplayName);
  const acceptedCount = Number(event.acceptedCount ?? 0);
  const spotsRemaining = Math.max(event.maxParticipants - acceptedCount, 0);
  const viewerStatus = event.viewerJoinRequestStatus ?? null;
  const hostUpdatesUnseenRaw = Number(event.viewerHostUpdatesUnseen ?? 0);
  const hostUpdatesUnseenCount =
    viewerStatus === JoinRequestStatus.ACCEPTED && hostUpdatesUnseenRaw > 0
      ? hostUpdatesUnseenRaw
      : null;

  return {
    id: event.id,
    title: event.title,
    description: event.description,
    datetime: typeof event.datetime === "string" ? event.datetime : event.datetime.toISOString(),
    locationName: event.locationName,
    maxParticipants: event.maxParticipants,
    status: event.status,
    hostId: event.hostId,
    hostDisplayName: event.hostDisplayName,
    hostPhotoUrl: event.hostPhotoUrl,
    hostInitials,
    spotsRemaining,
    createdAt: typeof event.createdAt === "string" ? event.createdAt : event.createdAt.toISOString(),
    updatedAt: typeof event.updatedAt === "string" ? event.updatedAt : event.updatedAt.toISOString(),
    distanceMeters: null,
    location: {
      latitude: event.latitude,
      longitude: event.longitude,
    },
    availability: {
      maxParticipants: event.maxParticipants,
      acceptedCount: event.acceptedCount,
      spotsRemaining,
    },
    host: {
      id: event.hostId,
      displayName: event.hostDisplayName,
      photoUrl: event.hostPhotoUrl,
      initials: hostInitials,
    },
    viewerJoinRequestStatus: viewerStatus,
    hostUpdatesUnseenCount,
  };
};

export const GET = requireAuth(async (_request, _context, auth) => {
  if (!auth.userId) {
    return createErrorResponse({
      message: "User ID is required.",
      status: 401,
      context: ROUTE_CONTEXT,
    });
  }

  try {
    const events = await findActiveEventsForMap(auth.userId);
    return NextResponse.json({ events: events.map(serializeEvent) });
  } catch (error) {
    return handleRouteError(error, ROUTE_CONTEXT, "Unable to fetch events");
  }
});
