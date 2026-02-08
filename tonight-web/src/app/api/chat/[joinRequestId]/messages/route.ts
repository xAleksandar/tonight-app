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
import { createErrorResponse, handleRouteError } from '@/lib/http/errors';

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

const GET_CONTEXT = 'GET /api/chat/[joinRequestId]/messages';
const POST_CONTEXT = 'POST /api/chat/[joinRequestId]/messages';

export const getChatMessagesHandler: AuthenticatedRouteHandler<NextResponse> = async (
  _request,
  context,
  auth
) => {
  const joinRequestIdParam = (context as RouteContext)?.params?.joinRequestId;
  const normalizedJoinRequestId = normalizeJoinRequestId(joinRequestIdParam);
  if ('error' in normalizedJoinRequestId) {
    return createErrorResponse({
      message: normalizedJoinRequestId.error,
      status: 400,
      context: GET_CONTEXT,
    });
  }

  try {
    const messages = await listMessagesForJoinRequest({
      joinRequestId: normalizedJoinRequestId.value,
      userId: auth.userId,
    });

    return NextResponse.json({ messages }, { status: 200 });
  } catch (error) {
    if (error instanceof ChatJoinRequestNotFoundError) {
      return createErrorResponse({
        message: 'Join request not found',
        status: 404,
        context: GET_CONTEXT,
      });
    }

    if (error instanceof ChatUnauthorizedError) {
      return createErrorResponse({
        message: 'You are not allowed to access this chat',
        status: 403,
        context: GET_CONTEXT,
      });
    }

    if (error instanceof ChatJoinRequestNotAcceptedError) {
      return createErrorResponse({
        message: 'Chat is only available for accepted join requests',
        status: 403,
        context: GET_CONTEXT,
      });
    }

    if (error instanceof ChatBlockedError) {
      return createErrorResponse({
        message: 'Chat is not available between blocked users',
        status: 403,
        context: GET_CONTEXT,
      });
    }

    return handleRouteError(error, GET_CONTEXT, 'Unable to fetch chat messages');
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
    return createErrorResponse({
      message: normalizedJoinRequestId.error,
      status: 400,
      context: POST_CONTEXT,
    });
  }

  const body = await parseRequestBody(request);
  if (!body) {
    return createErrorResponse({
      message: 'Invalid JSON body',
      status: 400,
      context: POST_CONTEXT,
    });
  }

  const contentField = normalizeMessageContentField(body.content);
  if ('error' in contentField) {
    return createErrorResponse({
      message: contentField.error,
      status: 400,
      context: POST_CONTEXT,
    });
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
      return createErrorResponse({
        message: 'Join request not found',
        status: 404,
        context: POST_CONTEXT,
      });
    }

    if (error instanceof ChatUnauthorizedError) {
      return createErrorResponse({
        message: 'You are not allowed to access this chat',
        status: 403,
        context: POST_CONTEXT,
      });
    }

    if (error instanceof ChatJoinRequestNotAcceptedError) {
      return createErrorResponse({
        message: 'Chat is only available for accepted join requests',
        status: 403,
        context: POST_CONTEXT,
      });
    }

    if (error instanceof ChatMessageValidationError) {
      return createErrorResponse({
        message: error.message,
        status: 400,
        context: POST_CONTEXT,
      });
    }

    if (error instanceof ChatBlockedError) {
      return createErrorResponse({
        message: 'Chat is not available between blocked users',
        status: 403,
        context: POST_CONTEXT,
      });
    }

    return handleRouteError(error, POST_CONTEXT, 'Unable to create chat message');
  }
};

export const GET = requireAuth(getChatMessagesHandler);
export const POST = requireAuth(postChatMessageHandler);
