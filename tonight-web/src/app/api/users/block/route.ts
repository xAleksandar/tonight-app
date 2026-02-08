import { NextRequest, NextResponse } from 'next/server';
import type { AuthenticatedRouteHandler } from '@/middleware/auth';
import { requireAuth } from '@/middleware/auth';
import {
  createBlockRecord,
  BlockUserDuplicateError,
  BlockUserSelfBlockError,
  BlockUserTargetNotFoundError,
  BlockUserValidationError,
} from '@/lib/blocking';
import { createErrorResponse, handleRouteError } from '@/lib/http/errors';

const parseRequestBody = async (request: NextRequest) => {
  try {
    return (await request.json()) as Record<string, unknown>;
  } catch {
    return null;
  }
};

const normalizeTargetUserId = (value: unknown) => {
  if (typeof value !== 'string') {
    return { error: 'User id must be a string' } as const;
  }

  const trimmed = value.trim();
  if (!trimmed) {
    return { error: 'User id is required' } as const;
  }

  return { value: trimmed } as const;
};

const ROUTE_CONTEXT = 'POST /api/users/block';

export const blockUserHandler: AuthenticatedRouteHandler<NextResponse> = async (
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

  const userField = normalizeTargetUserId(body.userId);
  if ('error' in userField) {
    return createErrorResponse({
      message: userField.error,
      status: 400,
      context: ROUTE_CONTEXT,
    });
  }

  try {
    const block = await createBlockRecord({
      blockerId: auth.userId,
      blockedId: userField.value,
    });

    return NextResponse.json({ block }, { status: 201 });
  } catch (error) {
    if (error instanceof BlockUserSelfBlockError) {
      return createErrorResponse({
        message: 'You cannot block yourself',
        status: 400,
        context: ROUTE_CONTEXT,
      });
    }

    if (error instanceof BlockUserTargetNotFoundError) {
      return createErrorResponse({
        message: 'User not found',
        status: 404,
        context: ROUTE_CONTEXT,
      });
    }

    if (error instanceof BlockUserDuplicateError) {
      return createErrorResponse({
        message: 'User already blocked',
        status: 409,
        context: ROUTE_CONTEXT,
      });
    }

    if (error instanceof BlockUserValidationError) {
      return createErrorResponse({
        message: error.message,
        status: 400,
        context: ROUTE_CONTEXT,
      });
    }

    return handleRouteError(error, ROUTE_CONTEXT, 'Unable to block user');
  }
};

export const POST = requireAuth(blockUserHandler);
