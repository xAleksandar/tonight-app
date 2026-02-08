import { NextRequest, NextResponse } from 'next/server';
import type { AuthenticatedRouteHandler } from '@/middleware/auth';
import { requireAuth } from '@/middleware/auth';
import { findNearbyEvents, DEFAULT_RADIUS_METERS } from '@/lib/geospatial';

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

const serializeNearbyEvent = (event: Awaited<ReturnType<typeof findNearbyEvents>>[number]) => {
  return {
    id: event.id,
    title: event.title,
    description: event.description,
    datetime: event.datetime.toISOString(),
    locationName: event.locationName,
    maxParticipants: event.maxParticipants,
    status: event.status,
    hostId: event.hostId,
    createdAt: event.createdAt.toISOString(),
    updatedAt: event.updatedAt.toISOString(),
    distanceMeters: event.distanceMeters,
  };
};

export const getNearbyEventsHandler: AuthenticatedRouteHandler<NextResponse> = async (
  request,
  _context,
  auth
) => {
  const parsedQuery = parseQuery(request);
  if ('error' in parsedQuery) {
    return NextResponse.json({ error: parsedQuery.error }, { status: 400 });
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
    console.error('Failed to fetch nearby events', error);
    return NextResponse.json({ error: 'Unable to fetch nearby events' }, { status: 500 });
  }
};

export const GET = requireAuth(getNearbyEventsHandler);
