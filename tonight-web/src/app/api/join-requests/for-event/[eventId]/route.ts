import { NextResponse } from 'next/server';
import type { AuthenticatedRouteHandler } from '@/middleware/auth';
import { requireAuth } from '@/middleware/auth';
import {
  listJoinRequestsForEvent,
  JoinRequestEventNotFoundError,
  JoinRequestUnauthorizedError,
} from '@/lib/join-requests';

interface RouteContext {
  params?: {
    eventId?: string;
  };
}

const normalizeEventId = (value: unknown) => {
  if (typeof value !== 'string') {
    return { error: 'Event id must be a string' } as const;
  }

  const trimmed = value.trim();
  if (!trimmed) {
    return { error: 'Event id is required' } as const;
  }

  return { value: trimmed } as const;
};

export const getJoinRequestsForEventHandler: AuthenticatedRouteHandler<NextResponse> = async (
  _request,
  context,
  auth
) => {
  const eventIdParam = (context as RouteContext)?.params?.eventId;
  const normalizedEventId = normalizeEventId(eventIdParam);
  if ('error' in normalizedEventId) {
    return NextResponse.json({ error: normalizedEventId.error }, { status: 400 });
  }

  try {
    const joinRequests = await listJoinRequestsForEvent({
      eventId: normalizedEventId.value,
      hostId: auth.userId,
    });

    return NextResponse.json({ joinRequests }, { status: 200 });
  } catch (error) {
    if (error instanceof JoinRequestEventNotFoundError) {
      return NextResponse.json({ error: 'Event not found' }, { status: 404 });
    }

    if (error instanceof JoinRequestUnauthorizedError) {
      return NextResponse.json({ error: 'You are not allowed to view join requests for this event' }, { status: 403 });
    }

    console.error('Failed to fetch join requests for event', error);
    return NextResponse.json({ error: 'Unable to fetch join requests' }, { status: 500 });
  }
};

export const GET = requireAuth(getJoinRequestsForEventHandler);
