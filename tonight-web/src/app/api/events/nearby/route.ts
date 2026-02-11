import { NextRequest, NextResponse } from 'next/server';
import type { AuthenticatedRouteHandler } from '@/middleware/auth';
import { requireAuth } from '@/middleware/auth';
import { findNearbyEvents, DEFAULT_RADIUS_METERS } from '@/lib/geospatial';
import { createErrorResponse, handleRouteError } from '@/lib/http/errors';

const LATITUDE_MIN = -90;
const LATITUDE_MAX = 90;
const LONGITUDE_MIN = -180;
const LONGITUDE_MAX = 180;

type ParsedQuery = {
  latitude: number;
  longitude: number;
  radius: number;
};

const parseNumber = (value: string | null) => {
  if (value === null) {
    return null;
  }

  if (value.trim().length === 0) {
    return null;
  }

  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : null;
};

const parseQuery = (request: NextRequest): ParsedQuery | { error: string } => {
  const { searchParams } = new URL(request.url);
  const latValue = parseNumber(searchParams.get('lat'));
  const lngValue = parseNumber(searchParams.get('lng'));
  const radiusValue = parseNumber(searchParams.get('radius'));

  if (latValue === null) {
    return { error: 'lat query parameter is required and must be a valid number' } as const;
  }

  if (lngValue === null) {
    return { error: 'lng query parameter is required and must be a valid number' } as const;
  }

  if (latValue < LATITUDE_MIN || latValue > LATITUDE_MAX) {
    return { error: `lat must be between ${LATITUDE_MIN} and ${LATITUDE_MAX}` } as const;
  }

  if (lngValue < LONGITUDE_MIN || lngValue > LONGITUDE_MAX) {
    return { error: `lng must be between ${LONGITUDE_MIN} and ${LONGITUDE_MAX}` } as const;
  }

  const radius = radiusValue !== null && radiusValue > 0 ? radiusValue : DEFAULT_RADIUS_METERS;

  return {
    latitude: latValue,
    longitude: lngValue,
    radius,
  };
};

export const buildHostInitials = (value: string | null | undefined) => {
  if (!value) {
    return 'YN';
  }
  const trimmed = value.trim();
  if (!trimmed) {
    return 'YN';
  }
  const parts = trimmed.split(/\s+/).filter(Boolean);
  if (parts.length === 0) {
    return 'YN';
  }
  const initials = parts
    .slice(0, 2)
    .map((segment) => segment.charAt(0).toUpperCase())
    .join('');
  return initials || 'YN';
};

const serializeNearbyEvent = (event: Awaited<ReturnType<typeof findNearbyEvents>>[number]) => {
  const hostInitials = buildHostInitials(event.hostDisplayName);
  const acceptedCount = Number(event.acceptedCount ?? 0);
  const spotsRemaining = Math.max(event.maxParticipants - acceptedCount, 0);

  return {
    id: event.id,
    title: event.title,
    description: event.description,
    datetime: typeof event.datetime === 'string' ? event.datetime : event.datetime.toISOString(),
    locationName: event.locationName,
    maxParticipants: event.maxParticipants,
    status: event.status,
    hostId: event.hostId,
    hostDisplayName: event.hostDisplayName,
    hostPhotoUrl: event.hostPhotoUrl,
    hostInitials,
    spotsRemaining,
    createdAt: typeof event.createdAt === 'string' ? event.createdAt : event.createdAt.toISOString(),
    updatedAt: typeof event.updatedAt === 'string' ? event.updatedAt : event.updatedAt.toISOString(),
    distanceMeters: event.distanceMeters,
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
  };
};

const ROUTE_CONTEXT = 'GET /api/events/nearby';

export const getNearbyEventsHandler: AuthenticatedRouteHandler<NextResponse> = async (
  request,
  _context,
  auth
) => {
  const parsedQuery = parseQuery(request);
  if ('error' in parsedQuery) {
    return createErrorResponse({
      message: parsedQuery.error,
      status: 400,
      context: ROUTE_CONTEXT,
    });
  }

  try {
    const events = await findNearbyEvents(
      parsedQuery.latitude,
      parsedQuery.longitude,
      parsedQuery.radius,
      auth.userId
    );

    return NextResponse.json({
      events: events.map(serializeNearbyEvent),
      meta: {
        latitude: parsedQuery.latitude,
        longitude: parsedQuery.longitude,
        radiusMeters: parsedQuery.radius,
      },
    });
  } catch (error) {
    return handleRouteError(error, ROUTE_CONTEXT, 'Unable to fetch nearby events');
  }
};

export const GET = requireAuth(getNearbyEventsHandler);
