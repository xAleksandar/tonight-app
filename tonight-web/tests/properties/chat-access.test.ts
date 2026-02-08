import { describe, it, expect, vi, beforeEach } from 'vitest';
import fc from 'fast-check';
import { JoinRequestStatus } from '@/generated/prisma/client';
import {
  listMessagesForJoinRequest,
  ChatJoinRequestNotAcceptedError,
} from '@/lib/chat';

type MockPrisma = {
  joinRequest: {
    findUnique: ReturnType<typeof vi.fn>;
  };
  message: {
    findMany: ReturnType<typeof vi.fn>;
  };
};

function createMockPrisma(): MockPrisma {
  return {
    joinRequest: {
      findUnique: vi.fn(),
    },
    message: {
      findMany: vi.fn(),
    },
  };
}
type GlobalWithPrisma = typeof globalThis & { __TEST_PRISMA__?: MockPrisma };

vi.mock('@/lib/prisma', () => {
  const prisma = createMockPrisma();
  (globalThis as GlobalWithPrisma).__TEST_PRISMA__ = prisma;
  return { prisma };
});

const getMockPrisma = (): MockPrisma => {
  const prisma = (globalThis as GlobalWithPrisma).__TEST_PRISMA__;
  if (!prisma) {
    throw new Error('Mock Prisma not initialized');
  }
  return prisma;
};

beforeEach(() => {
  const prisma = getMockPrisma();
  prisma.joinRequest.findUnique.mockReset();
  prisma.message.findMany.mockReset();
});

const messagesArbitrary = fc.array(
  fc.record({
    id: fc.uuid(),
    senderId: fc.uuid(),
    content: fc.string({ minLength: 1, maxLength: 256 }),
    createdAt: fc.date({ min: new Date('2030-01-01T00:00:00.000Z'), max: new Date('2035-12-31T23:59:59.000Z') }),
  }),
  { maxLength: 5 }
);

describe('Property 27: Chat Access Control for Accepted Requests', () => {
  it('allows both event hosts and accepted participants to list chat messages', async () => {
    await fc.assert(
      fc.asyncProperty(
        fc.uuid(),
        fc.uuid(),
        fc.uuid(),
        messagesArbitrary,
        fc.boolean(),
        async (joinRequestId, hostId, participantId, messages, requesterIsHost) => {
          const prisma = getMockPrisma();

          prisma.joinRequest.findUnique.mockResolvedValue({
            id: joinRequestId,
            status: JoinRequestStatus.ACCEPTED,
            userId: participantId,
            event: { hostId },
          });

          prisma.message.findMany.mockResolvedValue(
            messages.map((message) => ({
              id: message.id,
              joinRequestId,
              senderId: message.senderId,
              content: message.content,
              createdAt: message.createdAt,
            }))
          );

          const userId = requesterIsHost ? hostId : participantId;
          const result = await listMessagesForJoinRequest({ joinRequestId, userId });

          expect(prisma.joinRequest.findUnique).toHaveBeenCalledWith({
            where: { id: joinRequestId },
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

          expect(prisma.message.findMany).toHaveBeenCalledWith({
            where: { joinRequestId },
            orderBy: { createdAt: 'asc' },
          });

          expect(result).toEqual(
            messages.map((message) => ({
              id: message.id,
              joinRequestId,
              senderId: message.senderId,
              content: message.content,
              createdAt: message.createdAt.toISOString(),
            }))
          );
        }
      )
    );
  });
});

describe('Property 28: Chat Access Denial for Non-Accepted Requests', () => {
  it('rejects chat access when the join request is not accepted', async () => {
    await fc.assert(
      fc.asyncProperty(
        fc.uuid(),
        fc.uuid(),
        fc.uuid(),
        fc.constantFrom(JoinRequestStatus.PENDING, JoinRequestStatus.REJECTED),
        fc.boolean(),
        async (joinRequestId, hostId, participantId, status, requesterIsHost) => {
          const prisma = getMockPrisma();
          prisma.joinRequest.findUnique.mockResolvedValue({
            id: joinRequestId,
            status,
            userId: participantId,
            event: { hostId },
          });

          const userId = requesterIsHost ? hostId : participantId;

          await expect(listMessagesForJoinRequest({ joinRequestId, userId })).rejects.toBeInstanceOf(
            ChatJoinRequestNotAcceptedError
          );

          expect(prisma.message.findMany).not.toHaveBeenCalled();
        }
      )
    );
  });
});
