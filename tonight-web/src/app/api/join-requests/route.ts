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

export const createJoinRequestHandler: AuthenticatedRouteHandler<NextResponse> = async (
  request,
  _context,
  auth
) => {
  const body = await parseRequestBody(request);
  if (!body) {
    return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 });
  }

  const eventField = normalizeEventId(body.eventId);
  if ('error' in eventField) {
    return NextResponse.json({ error: eventField.error }, { status: 400 });
  }

  try {
    const joinRequest = await createJoinRequest({
      eventId: eventField.value,
      userId: auth.userId,
    });

    return NextResponse.json({ joinRequest }, { status: 201 });
  } catch (error) {
    if (error instanceof JoinRequestEventNotFoundError) {
      return NextResponse.json({ error: 'Event not found' }, { status: 404 });
    }

    if (error instanceof JoinRequestInactiveEventError) {
      return NextResponse.json({ error: 'This event is not accepting join requests' }, { status: 409 });
    }

    if (error instanceof JoinRequestDuplicateError) {
      return NextResponse.json({ error: 'You have already requested to join this event' }, { status: 409 });
    }

    if (error instanceof JoinRequestEventFullError) {
      return NextResponse.json({ error: 'This event is already full' }, { status: 409 });
    }

    console.error('Failed to create join request', error);
    return NextResponse.json({ error: 'Unable to create join request' }, { status: 500 });
  }
};

export const POST = requireAuth(createJoinRequestHandler);
