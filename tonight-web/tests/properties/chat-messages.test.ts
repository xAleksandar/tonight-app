import { describe, it, expect, vi, beforeEach } from 'vitest';
import fc from 'fast-check';
import { JoinRequestStatus } from '@/generated/prisma/client';
import { createMessageForJoinRequest, CHAT_MESSAGE_MAX_LENGTH } from '@/lib/chat';

type MockPrisma = {
  joinRequest: {
    findUnique: ReturnType<typeof vi.fn>;
  };
  message: {
    create: ReturnType<typeof vi.fn>;
  };
};

type MockSocketService = {
  emitMessage: ReturnType<typeof vi.fn>;
};

type GlobalWithMocks = typeof globalThis & {
  __TEST_PRISMA__?: MockPrisma;
  __TEST_SOCKET__?: MockSocketService;
};

function createMockPrisma(): MockPrisma {
  return {
    joinRequest: {
      findUnique: vi.fn(),
    },
    message: {
      create: vi.fn(),
    },
  };
}

function createMockSocketService(): MockSocketService {
  return {
    emitMessage: vi.fn(),
  };
}

vi.mock('@/lib/prisma', () => {
  const prisma = createMockPrisma();
  (globalThis as GlobalWithMocks).__TEST_PRISMA__ = prisma;
  return { prisma };
});

vi.mock('@/lib/socket', () => {
  const socketService = createMockSocketService();
  (globalThis as GlobalWithMocks).__TEST_SOCKET__ = socketService;
  return { socketService };
});

const getMockPrisma = (): MockPrisma => {
  const prisma = (globalThis as GlobalWithMocks).__TEST_PRISMA__;
  if (!prisma) {
    throw new Error('Mock Prisma not initialized');
  }
  return prisma;
};

const getMockSocketService = (): MockSocketService => {
  const socketService = (globalThis as GlobalWithMocks).__TEST_SOCKET__;
  if (!socketService) {
    throw new Error('Mock SocketService not initialized');
  }
  return socketService;
};

const whitespaceArbitrary = fc
  .array(fc.constantFrom(' ', '\n', '\r', '\t'), { maxLength: 4 })
  .map((chars) => chars.join(''));

const messageContentArbitrary = fc
  .tuple(
    whitespaceArbitrary,
    fc.string({ minLength: 1, maxLength: CHAT_MESSAGE_MAX_LENGTH }),
    whitespaceArbitrary
  )
  .map(([leading, core, trailing]) => `${leading}${core}${trailing}`)
  .filter((value) => value.trim().length > 0 && value.trim().length <= CHAT_MESSAGE_MAX_LENGTH);

beforeEach(() => {
  const prisma = getMockPrisma();
  prisma.joinRequest.findUnique.mockReset();
  prisma.message.create.mockReset();

  const socketService = getMockSocketService();
  socketService.emitMessage.mockReset();
});

const buildAcceptedJoinRequest = (
  joinRequestId: string,
  hostId: string,
  participantId: string
) => ({
  id: joinRequestId,
  status: JoinRequestStatus.ACCEPTED,
  userId: participantId,
  event: { hostId },
});

describe('Property 29: Message Storage Round Trip', () => {
  it('persists trimmed chat messages for accepted hosts and participants', async () => {
    await fc.assert(
      fc.asyncProperty(
        fc.uuid(),
        fc.uuid(),
        fc.uuid(),
        fc.uuid(),
        fc
          .integer({
            min: Date.parse('2030-01-01T00:00:00.000Z'),
            max: Date.parse('2035-12-31T23:59:59.000Z'),
          })
          .map((timestamp) => new Date(timestamp)),
        messageContentArbitrary,
        fc.boolean(),
        async (joinRequestId, hostId, participantId, messageId, createdAt, content, requesterIsHost) => {
          const prisma = getMockPrisma();
          const socketService = getMockSocketService();

          prisma.joinRequest.findUnique.mockResolvedValue(
            buildAcceptedJoinRequest(joinRequestId, hostId, participantId)
          );

          const trimmedContent = content.trim();
          const userId = requesterIsHost ? hostId : participantId;

          prisma.message.create.mockResolvedValue({
            id: messageId,
            joinRequestId,
            senderId: userId,
            content: trimmedContent,
            createdAt,
          });

          const result = await createMessageForJoinRequest({ joinRequestId, userId, content });

          expect(prisma.message.create).toHaveBeenCalledWith({
            data: {
              joinRequestId,
              senderId: userId,
              content: trimmedContent,
            },
          });

          expect(result).toEqual({
            id: messageId,
            joinRequestId,
            senderId: userId,
            content: trimmedContent,
            createdAt: createdAt.toISOString(),
          });

          expect(socketService.emitMessage).toHaveBeenCalledWith(joinRequestId, result);
        }
      )
    );
  });
});

describe('Property 30: Real-Time Message Delivery', () => {
  it('attempts socket delivery for every stored message and tolerates emitter failures', async () => {
    await fc.assert(
      fc.asyncProperty(
        fc.uuid(),
        fc.uuid(),
        fc.uuid(),
        fc.uuid(),
        fc
          .integer({
            min: Date.parse('2030-01-01T00:00:00.000Z'),
            max: Date.parse('2035-12-31T23:59:59.000Z'),
          })
          .map((timestamp) => new Date(timestamp)),
        messageContentArbitrary,
        fc.boolean(),
        fc.boolean(),
        async (
          joinRequestId,
          hostId,
          participantId,
          messageId,
          createdAt,
          content,
          requesterIsHost,
          emitterThrows
        ) => {
          const prisma = getMockPrisma();
          const socketService = getMockSocketService();

          prisma.joinRequest.findUnique.mockResolvedValue(
            buildAcceptedJoinRequest(joinRequestId, hostId, participantId)
          );

          const trimmedContent = content.trim();
          const userId = requesterIsHost ? hostId : participantId;

          prisma.message.create.mockResolvedValue({
            id: messageId,
            joinRequestId,
            senderId: userId,
            content: trimmedContent,
            createdAt,
          });

          socketService.emitMessage.mockImplementation(() => {});
          const consoleErrorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});

          if (emitterThrows) {
            socketService.emitMessage.mockImplementation(() => {
              throw new Error('Socket delivery failed');
            });
          }

          const result = await createMessageForJoinRequest({ joinRequestId, userId, content });

          expect(socketService.emitMessage).toHaveBeenCalledWith(joinRequestId, result);
          expect(result).toEqual({
            id: messageId,
            joinRequestId,
            senderId: userId,
            content: trimmedContent,
            createdAt: createdAt.toISOString(),
          });

          if (emitterThrows) {
            expect(consoleErrorSpy).toHaveBeenCalledWith(
              'Failed to emit chat message via Socket.IO',
              expect.any(Error)
            );
          } else {
            expect(consoleErrorSpy).not.toHaveBeenCalled();
          }

          consoleErrorSpy.mockRestore();
        }
      )
    );
  });
});
