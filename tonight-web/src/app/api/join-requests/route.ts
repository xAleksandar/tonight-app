import { NextRequest, NextResponse } from 'next/server';
import type { AuthenticatedRouteHandler } from '@/middleware/auth';
import { requireAuth } from '@/middleware/auth';
import {
  createJoinRequest,
  JoinRequestDuplicateError,
  JoinRequestEventFullError,
  JoinRequestEventNotFoundError,
  JoinRequestInactiveEventError,
} from '@/lib/join-requests';
import { createErrorResponse, handleRouteError } from '@/lib/http/errors';

const parseRequestBody = async (request: NextRequest) => {
  try {
    return (await request.json()) as Record<string, unknown>;
  } catch {
    return null;
  }
};

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

const ROUTE_CONTEXT = 'POST /api/join-requests';

export const createJoinRequestHandler: AuthenticatedRouteHandler<NextResponse> = async (
  request,
  _context,
  auth
) => {
  const body = await parseRequestBody(request);
  if (!body) {
    return createErrorResponse({
      message: 'Invalid JSON body',
      status: 400,
      context: ROUTE_CONTEXT,
    });
  }

  const eventField = normalizeEventId(body.eventId);
  if ('error' in eventField) {
    return createErrorResponse({
      message: eventField.error ?? 'Invalid event ID',
      status: 400,
      context: ROUTE_CONTEXT,
    });
  }

  try {
    const joinRequest = await createJoinRequest({
      eventId: eventField.value,
      userId: auth.userId,
    });

    return NextResponse.json({ joinRequest }, { status: 201 });
  } catch (error) {
    if (error instanceof JoinRequestEventNotFoundError) {
      return createErrorResponse({
        message: 'Event not found',
        status: 404,
        context: ROUTE_CONTEXT,
      });
    }

    if (error instanceof JoinRequestInactiveEventError) {
      return createErrorResponse({
        message: 'This event is not accepting join requests',
        status: 409,
        context: ROUTE_CONTEXT,
      });
    }

    if (error instanceof JoinRequestDuplicateError) {
      return createErrorResponse({
        message: 'You have already requested to join this event',
        status: 409,
        context: ROUTE_CONTEXT,
      });
    }

    if (error instanceof JoinRequestEventFullError) {
      return createErrorResponse({
        message: 'This event is already full',
        status: 409,
        context: ROUTE_CONTEXT,
      });
    }

    return handleRouteError(error, ROUTE_CONTEXT, 'Unable to create join request');
  }
};

export const POST = requireAuth(createJoinRequestHandler);
