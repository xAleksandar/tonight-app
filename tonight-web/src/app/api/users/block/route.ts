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

export const blockUserHandler: AuthenticatedRouteHandler<NextResponse> = async (
  request,
  _context,
  auth
) => {
  const body = await parseRequestBody(request);
  if (!body) {
    return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 });
  }

  const userField = normalizeTargetUserId(body.userId);
  if ('error' in userField) {
    return NextResponse.json({ error: userField.error }, { status: 400 });
  }

  try {
    const block = await createBlockRecord({
      blockerId: auth.userId,
      blockedId: userField.value,
    });

    return NextResponse.json({ block }, { status: 201 });
  } catch (error) {
    if (error instanceof BlockUserSelfBlockError) {
      return NextResponse.json({ error: 'You cannot block yourself' }, { status: 400 });
    }

    if (error instanceof BlockUserTargetNotFoundError) {
      return NextResponse.json({ error: 'User not found' }, { status: 404 });
    }

    if (error instanceof BlockUserDuplicateError) {
      return NextResponse.json({ error: 'User already blocked' }, { status: 409 });
    }

    if (error instanceof BlockUserValidationError) {
      return NextResponse.json({ error: error.message }, { status: 400 });
    }

    console.error('Failed to create block record', error);
    return NextResponse.json({ error: 'Unable to block user' }, { status: 500 });
  }
};

export const POST = requireAuth(blockUserHandler);
