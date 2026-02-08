import { NextResponse } from 'next/server';
import type { AuthenticatedRouteHandler } from '@/middleware/auth';
import { requireAuth } from '@/middleware/auth';
import {
  listJoinRequestsForEvent,
  JoinRequestEventNotFoundError,
  JoinRequestUnauthorizedError,
} from '@/lib/join-requests';
import { createErrorResponse, handleRouteError } from '@/lib/http/errors';

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

const ROUTE_CONTEXT = 'GET /api/join-requests/for-event/[eventId]';

export const getJoinRequestsForEventHandler: AuthenticatedRouteHandler<NextResponse> = async (
  _request,
  context,
  auth
) => {
  const eventIdParam = (context as RouteContext)?.params?.eventId;
  const normalizedEventId = normalizeEventId(eventIdParam);
  if ('error' in normalizedEventId) {
    return createErrorResponse({
      message: normalizedEventId.error,
      status: 400,
      context: ROUTE_CONTEXT,
    });
  }

  try {
    const joinRequests = await listJoinRequestsForEvent({
      eventId: normalizedEventId.value,
      hostId: auth.userId,
    });

    return NextResponse.json({ joinRequests }, { status: 200 });
  } catch (error) {
    if (error instanceof JoinRequestEventNotFoundError) {
      return createErrorResponse({
        message: 'Event not found',
        status: 404,
        context: ROUTE_CONTEXT,
      });
    }

    if (error instanceof JoinRequestUnauthorizedError) {
      return createErrorResponse({
        message: 'You are not allowed to view join requests for this event',
        status: 403,
        context: ROUTE_CONTEXT,
      });
    }

    return handleRouteError(error, ROUTE_CONTEXT, 'Unable to fetch join requests');
  }
};

export const GET = requireAuth(getJoinRequestsForEventHandler);
