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
import { createErrorResponse, handleRouteError } from '@/lib/http/errors';

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

const ROUTE_CONTEXT = 'PATCH /api/join-requests/[id]';

export const patchJoinRequestHandler: AuthenticatedRouteHandler<NextResponse> = async (
  request,
  context,
  auth
) => {
  const joinRequestId = (context as RouteContext).params?.id;
  if (!joinRequestId) {
    return createErrorResponse({
      message: 'Join request id is required',
      status: 400,
      context: ROUTE_CONTEXT,
    });
  }

  const body = await parseRequestBody(request);
  if (!body) {
    return createErrorResponse({
      message: 'Invalid JSON body',
      status: 400,
      context: ROUTE_CONTEXT,
    });
  }

  const statusField = normalizeStatus(body.status);
  if ('error' in statusField) {
    return createErrorResponse({
      message: statusField.error,
      status: 400,
      context: ROUTE_CONTEXT,
    });
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
      return createErrorResponse({
        message: 'Join request not found',
        status: 404,
        context: ROUTE_CONTEXT,
      });
    }

    if (error instanceof JoinRequestUnauthorizedError) {
      return createErrorResponse({
        message: 'You are not allowed to modify this join request',
        status: 403,
        context: ROUTE_CONTEXT,
      });
    }

    if (error instanceof JoinRequestInvalidStatusError) {
      return createErrorResponse({
        message: 'Status must be "accepted" or "rejected"',
        status: 400,
        context: ROUTE_CONTEXT,
      });
    }

    if (error instanceof JoinRequestInactiveEventError) {
      return createErrorResponse({
        message: 'This event is not active',
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

    return handleRouteError(error, ROUTE_CONTEXT, 'Unable to update join request');
  }
};

export const PATCH = requireAuth(patchJoinRequestHandler);
