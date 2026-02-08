import { NextRequest, NextResponse } from 'next/server';
import { JoinRequestStatus } from '@/generated/prisma/client';
import type { AuthenticatedRouteHandler } from '@/middleware/auth';
import { requireAuth } from '@/middleware/auth';
import {
  updateJoinRequestStatus,
  JoinRequestEventFullError,
  JoinRequestInactiveEventError,
  JoinRequestInvalidStatusError,
  JoinRequestNotFoundError,
  JoinRequestUnauthorizedError,
} from '@/lib/join-requests';

type RouteContext = {
  params: {
    id?: string;
  };
};

const parseRequestBody = async (request: NextRequest) => {
  try {
    return (await request.json()) as Record<string, unknown>;
  } catch {
    return null;
  }
};

const normalizeStatus = (value: unknown) => {
  if (typeof value !== 'string') {
    return { error: 'Status must be a string' } as const;
  }

  const normalized = value.trim().toLowerCase();
  if (!normalized) {
    return { error: 'Status is required' } as const;
  }

  if (normalized === 'accepted') {
    return { value: JoinRequestStatus.ACCEPTED } as const;
  }

  if (normalized === 'rejected') {
    return { value: JoinRequestStatus.REJECTED } as const;
  }

  return { error: 'Status must be "accepted" or "rejected"' } as const;
};

export const patchJoinRequestHandler: AuthenticatedRouteHandler<NextResponse> = async (
  request,
  context,
  auth
) => {
  const joinRequestId = (context as RouteContext).params?.id;
  if (!joinRequestId) {
    return NextResponse.json({ error: 'Join request id is required' }, { status: 400 });
  }

  const body = await parseRequestBody(request);
  if (!body) {
    return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 });
  }

  const statusField = normalizeStatus(body.status);
  if ('error' in statusField) {
    return NextResponse.json({ error: statusField.error }, { status: 400 });
  }

  try {
    const joinRequest = await updateJoinRequestStatus({
      joinRequestId,
      hostId: auth.userId,
      status: statusField.value,
    });

    return NextResponse.json({ joinRequest }, { status: 200 });
  } catch (error) {
    if (error instanceof JoinRequestNotFoundError) {
      return NextResponse.json({ error: 'Join request not found' }, { status: 404 });
    }

    if (error instanceof JoinRequestUnauthorizedError) {
      return NextResponse.json({ error: 'You are not allowed to modify this join request' }, { status: 403 });
    }

    if (error instanceof JoinRequestInvalidStatusError) {
      return NextResponse.json({ error: 'Status must be "accepted" or "rejected"' }, { status: 400 });
    }

    if (error instanceof JoinRequestInactiveEventError) {
      return NextResponse.json({ error: 'This event is not active' }, { status: 409 });
    }

    if (error instanceof JoinRequestEventFullError) {
      return NextResponse.json({ error: 'This event is already full' }, { status: 409 });
    }

    console.error('Failed to update join request status', error);
    return NextResponse.json({ error: 'Unable to update join request' }, { status: 500 });
  }
};

export const PATCH = requireAuth(patchJoinRequestHandler);
