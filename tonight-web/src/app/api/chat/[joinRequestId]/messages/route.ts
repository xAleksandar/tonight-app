import { NextRequest, NextResponse } from 'next/server';
import type { AuthenticatedRouteHandler } from '@/middleware/auth';
import { requireAuth } from '@/middleware/auth';
import {
  listMessagesForJoinRequest,
  createMessageForJoinRequest,
  ChatJoinRequestNotFoundError,
  ChatUnauthorizedError,
  ChatJoinRequestNotAcceptedError,
  ChatMessageValidationError,
  ChatBlockedError,
} from '@/lib/chat';

interface RouteContext {
  params?: {
    joinRequestId?: string;
  };
}

const normalizeJoinRequestId = (value: unknown) => {
  if (typeof value !== 'string') {
    return { error: 'Join request id must be a string' } as const;
  }

  const trimmed = value.trim();
  if (!trimmed) {
    return { error: 'Join request id is required' } as const;
  }

  return { value: trimmed } as const;
};

const parseRequestBody = async (request: NextRequest) => {
  try {
    return (await request.json()) as Record<string, unknown>;
  } catch {
    return null;
  }
};

const normalizeMessageContentField = (value: unknown) => {
  if (typeof value !== 'string') {
    return { error: 'Message content must be a string' } as const;
  }

  return { value } as const;
};

export const getChatMessagesHandler: AuthenticatedRouteHandler<NextResponse> = async (
  _request,
  context,
  auth
) => {
  const joinRequestIdParam = (context as RouteContext)?.params?.joinRequestId;
  const normalizedJoinRequestId = normalizeJoinRequestId(joinRequestIdParam);
  if ('error' in normalizedJoinRequestId) {
    return NextResponse.json({ error: normalizedJoinRequestId.error }, { status: 400 });
  }

  try {
    const messages = await listMessagesForJoinRequest({
      joinRequestId: normalizedJoinRequestId.value,
      userId: auth.userId,
    });

    return NextResponse.json({ messages }, { status: 200 });
  } catch (error) {
    if (error instanceof ChatJoinRequestNotFoundError) {
      return NextResponse.json({ error: 'Join request not found' }, { status: 404 });
    }

    if (error instanceof ChatUnauthorizedError) {
      return NextResponse.json({ error: 'You are not allowed to access this chat' }, { status: 403 });
    }

    if (error instanceof ChatJoinRequestNotAcceptedError) {
      return NextResponse.json({ error: 'Chat is only available for accepted join requests' }, { status: 403 });
    }

    if (error instanceof ChatBlockedError) {
      return NextResponse.json({ error: 'Chat is not available between blocked users' }, { status: 403 });
    }

    console.error('Failed to fetch chat messages', error);
    return NextResponse.json({ error: 'Unable to fetch chat messages' }, { status: 500 });
  }
};

export const postChatMessageHandler: AuthenticatedRouteHandler<NextResponse> = async (
  request,
  context,
  auth
) => {
  const joinRequestIdParam = (context as RouteContext)?.params?.joinRequestId;
  const normalizedJoinRequestId = normalizeJoinRequestId(joinRequestIdParam);
  if ('error' in normalizedJoinRequestId) {
    return NextResponse.json({ error: normalizedJoinRequestId.error }, { status: 400 });
  }

  const body = await parseRequestBody(request);
  if (!body) {
    return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 });
  }

  const contentField = normalizeMessageContentField(body.content);
  if ('error' in contentField) {
    return NextResponse.json({ error: contentField.error }, { status: 400 });
  }

  try {
    const message = await createMessageForJoinRequest({
      joinRequestId: normalizedJoinRequestId.value,
      userId: auth.userId,
      content: contentField.value,
    });

    return NextResponse.json({ message }, { status: 201 });
  } catch (error) {
    if (error instanceof ChatJoinRequestNotFoundError) {
      return NextResponse.json({ error: 'Join request not found' }, { status: 404 });
    }

    if (error instanceof ChatUnauthorizedError) {
      return NextResponse.json({ error: 'You are not allowed to access this chat' }, { status: 403 });
    }

    if (error instanceof ChatJoinRequestNotAcceptedError) {
      return NextResponse.json({ error: 'Chat is only available for accepted join requests' }, { status: 403 });
    }

    if (error instanceof ChatMessageValidationError) {
      return NextResponse.json({ error: error.message }, { status: 400 });
    }

    if (error instanceof ChatBlockedError) {
      return NextResponse.json({ error: 'Chat is not available between blocked users' }, { status: 403 });
    }

    console.error('Failed to create chat message', error);
    return NextResponse.json({ error: 'Unable to create chat message' }, { status: 500 });
  }
};

export const GET = requireAuth(getChatMessagesHandler);
export const POST = requireAuth(postChatMessageHandler);
