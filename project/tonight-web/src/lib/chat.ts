import { JoinRequestStatus, type Message, type JoinRequest } from '@/generated/prisma/client';
import { prisma } from '@/lib/prisma';
import { socketService } from '@/lib/socket';
import { chatRateLimiter } from '@/lib/chat-rate-limiter';

export class ChatError extends Error {
  constructor(message: string) {
    super(message);
    this.name = new.target.name;
  }
}

export class ChatJoinRequestNotFoundError extends ChatError {}
export class ChatUnauthorizedError extends ChatError {}
export class ChatJoinRequestNotAcceptedError extends ChatError {}
export class ChatMessageValidationError extends ChatError {}
export class ChatBlockedError extends ChatError {}

export type SerializedMessageReadReceipt = {
  userId: string;
  readAt: string;
};

export type SerializedMessage = {
  id: string;
  joinRequestId: string;
  senderId: string;
  content: string;
  createdAt: string;
  readBy: SerializedMessageReadReceipt[];
};

export type ChatAccessInput = {
  joinRequestId: string;
  userId: string;
};

export type ChatAccessContext = {
  joinRequestId: string;
  hostId: string;
  participantId: string;
  requesterRole: 'host' | 'participant';
};

export type CreateChatMessageInput = ChatAccessInput & {
  content: string;
};

export type CreateChatMessageOptions = {
  skipRateLimit?: boolean;
};

type JoinRequestAccessRecord = {
  id: string;
  status: JoinRequestStatus;
  userId: string;
  event: {
    hostId: string;
  };
};

export const CHAT_MESSAGE_MAX_LENGTH = 1000;

const serializeMessage = (
  record: Message & { readBy?: Array<{ userId: string; readAt: Date }> }
): SerializedMessage => ({
  id: record.id,
  joinRequestId: record.joinRequestId,
  senderId: record.senderId,
  content: record.content,
  createdAt: record.createdAt.toISOString(),
  readBy: (record.readBy ?? []).map((entry) => ({
    userId: entry.userId,
    readAt: entry.readAt.toISOString(),
  })),
});

const normalizeParticipantRole = (joinRequest: JoinRequestAccessRecord, userId: string) => {
  if (joinRequest.event.hostId === userId) {
    return 'host' as const;
  }

  if (joinRequest.userId === userId) {
    return 'participant' as const;
  }

  return null;
};

const assertParticipantsNotBlocked = async (hostId: string, participantId: string) => {
  const existingBlock = await prisma.blockedUser.findFirst({
    where: {
      OR: [
        { blockerId: hostId, blockedId: participantId },
        { blockerId: participantId, blockedId: hostId },
      ],
    },
    select: { id: true },
  });

  if (existingBlock) {
    throw new ChatBlockedError('Chat is not available between blocked users');
  }
};

const ensureChatAccess = async (input: ChatAccessInput) => {
  const joinRequest = await prisma.joinRequest.findUnique({
    where: { id: input.joinRequestId },
    select: {
      id: true,
      status: true,
      userId: true,
      event: {
        select: {
          hostId: true,
        },
      },
    },
  });

  if (!joinRequest) {
    throw new ChatJoinRequestNotFoundError('Join request not found');
  }

  const role = normalizeParticipantRole(joinRequest as JoinRequest & { event: { hostId: string } }, input.userId);
  if (!role) {
    throw new ChatUnauthorizedError('You are not allowed to access this chat');
  }

  if (joinRequest.status !== JoinRequestStatus.ACCEPTED) {
    throw new ChatJoinRequestNotAcceptedError('Chat is only available for accepted join requests');
  }

  await assertParticipantsNotBlocked(joinRequest.event.hostId, joinRequest.userId);

  return {
    joinRequestId: joinRequest.id,
    hostId: joinRequest.event.hostId,
    participantId: joinRequest.userId,
    requesterRole: role,
  } satisfies ChatAccessContext;
};

const normalizeMessageContent = (content: string): string => {
  const trimmed = content.trim();
  if (!trimmed) {
    throw new ChatMessageValidationError('Message content is required');
  }

  if (trimmed.length > CHAT_MESSAGE_MAX_LENGTH) {
    throw new ChatMessageValidationError(
      `Message content must be at most ${CHAT_MESSAGE_MAX_LENGTH} characters`
    );
  }

  return trimmed;
};

export const listMessagesForJoinRequest = async (
  input: ChatAccessInput
): Promise<SerializedMessage[]> => {
  await ensureChatAccess(input);

  const messages = await prisma.message.findMany({
    where: {
      joinRequestId: input.joinRequestId,
    },
    orderBy: {
      createdAt: 'asc',
    },
    include: {
      readBy: {
        select: {
          userId: true,
          readAt: true,
        },
      },
    },
  });

  return messages.map((record) => serializeMessage(record));
};

export const createMessageForJoinRequest = async (
  input: CreateChatMessageInput,
  options?: CreateChatMessageOptions
): Promise<SerializedMessage> => {
  // Rate limit check - MUST BE FIRST (unless explicitly skipped)
  if (!options?.skipRateLimit) {
    if (!chatRateLimiter.canSendMessage(input.userId)) {
      const secondsUntilReset = chatRateLimiter.getSecondsUntilReset(input.userId);
      throw new ChatMessageValidationError(
        `Message rate limit exceeded. Please wait ${secondsUntilReset} seconds before sending more messages.`
      );
    }
  }

  const context = await ensureChatAccess({
    joinRequestId: input.joinRequestId,
    userId: input.userId,
  });

  const content = normalizeMessageContent(input.content);

  const created = await prisma.message.create({
    data: {
      joinRequestId: context.joinRequestId,
      senderId: input.userId,
      content,
    },
    include: {
      readBy: {
        select: {
          userId: true,
          readAt: true,
        },
      },
    },
  });

  const serialized = serializeMessage(created);

  try {
    socketService.emitMessage(context.joinRequestId, serialized);
  } catch (error) {
    console.error('Failed to emit chat message via Socket.IO', error);
  }

  return serialized;
};

export const getChatAccessContext = ensureChatAccess;
