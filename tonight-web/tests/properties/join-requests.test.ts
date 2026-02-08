import { describe, it, expect, vi, beforeEach } from 'vitest';
import fc from 'fast-check';
import {
  createJoinRequest,
  updateJoinRequestStatus,
  listJoinRequestsForEvent,
  JoinRequestDuplicateError,
  JoinRequestEventFullError,
  JoinRequestEventNotFoundError,
  JoinRequestUnauthorizedError,
} from '@/lib/join-requests';
import { EventStatus, JoinRequestStatus } from '@/generated/prisma/client';

type MockPrisma = {
  event: {
    findUnique: ReturnType<typeof vi.fn>;
  };
  joinRequest: {
    findUnique: ReturnType<typeof vi.fn>;
    count: ReturnType<typeof vi.fn>;
    create: ReturnType<typeof vi.fn>;
    update: ReturnType<typeof vi.fn>;
    findMany: ReturnType<typeof vi.fn>;
  };
  $transaction: ReturnType<typeof vi.fn>;
};

type GlobalWithPrisma = typeof globalThis & { __TEST_PRISMA__?: MockPrisma };

function createMockPrisma(): MockPrisma {
  const eventDelegate = {
    findUnique: vi.fn(),
  } as MockPrisma['event'];

  const joinRequestDelegate = {
    findUnique: vi.fn(),
    count: vi.fn(),
    create: vi.fn(),
    update: vi.fn(),
    findMany: vi.fn(),
  } as MockPrisma['joinRequest'];

  const prisma: MockPrisma = {
    event: eventDelegate,
    joinRequest: joinRequestDelegate,
    $transaction: vi.fn(async (callback: (transactionClient: { event: typeof eventDelegate; joinRequest: typeof joinRequestDelegate }) => Promise<unknown>) =>
      callback({ event: eventDelegate, joinRequest: joinRequestDelegate })
    ),
  };

  return prisma;
}

vi.mock('@/lib/prisma', () => {
  const prisma = createMockPrisma();
  (globalThis as GlobalWithPrisma).__TEST_PRISMA__ = prisma;
  return { prisma };
});

const getMockPrisma = (): MockPrisma => {
  const prisma = (globalThis as GlobalWithPrisma).__TEST_PRISMA__;
  if (!prisma) {
    throw new Error('Mock Prisma is not initialized');
  }
  return prisma;
};

beforeEach(() => {
  const prisma = getMockPrisma();
  prisma.event.findUnique.mockReset();
  prisma.joinRequest.findUnique.mockReset();
  prisma.joinRequest.count.mockReset();
  prisma.joinRequest.create.mockReset();
  prisma.joinRequest.update.mockReset();
  prisma.joinRequest.findMany.mockReset();
  prisma.$transaction.mockReset();
  prisma.$transaction.mockImplementation(async (callback: (transactionClient: { event: typeof prisma.event; joinRequest: typeof prisma.joinRequest }) => Promise<unknown>) =>
    callback({ event: prisma.event, joinRequest: prisma.joinRequest })
  );
});

describe('Property 23: Join Request Creation with Pending Status', () => {
  it('creates a pending join request for any valid user-event pair', async () => {
    await fc.assert(
      fc.asyncProperty(
        fc.uuid(),
        fc.uuid(),
        fc.integer({ min: 2, max: 12 }),
        fc.uuid(),
        async (eventId, userId, maxParticipants, joinRequestId) => {
          const prisma = getMockPrisma();
          const timestamp = new Date('2030-01-01T00:00:00.000Z');

          prisma.event.findUnique.mockResolvedValue({
            id: eventId,
            status: EventStatus.ACTIVE,
            maxParticipants,
          });
          prisma.joinRequest.findUnique.mockResolvedValue(null);
          prisma.joinRequest.count.mockResolvedValue(0);
          prisma.joinRequest.create.mockResolvedValue({
            id: joinRequestId,
            eventId,
            userId,
            status: JoinRequestStatus.PENDING,
            createdAt: timestamp,
            updatedAt: timestamp,
          });

          const result = await createJoinRequest({ eventId, userId });
          expect(prisma.joinRequest.create).toHaveBeenCalledWith({
            data: {
              eventId,
              userId,
              status: JoinRequestStatus.PENDING,
            },
          });
          expect(result).toEqual({
            id: joinRequestId,
            eventId,
            userId,
            status: JoinRequestStatus.PENDING,
            createdAt: timestamp.toISOString(),
            updatedAt: timestamp.toISOString(),
          });
        }
      )
    );
  });
});

describe('Property 24: Duplicate Join Request Prevention', () => {
  it('rejects attempts to create multiple join requests for the same user and event', async () => {
    await fc.assert(
      fc.asyncProperty(fc.uuid(), fc.uuid(), fc.uuid(), async (eventId, userId, existingJoinRequestId) => {
        const prisma = getMockPrisma();
        const existingRecord = {
          id: existingJoinRequestId,
          eventId,
          userId,
          status: JoinRequestStatus.PENDING,
          createdAt: new Date('2030-01-01T00:00:00.000Z'),
          updatedAt: new Date('2030-01-01T00:00:00.000Z'),
        };

        prisma.event.findUnique.mockResolvedValue({
          id: eventId,
          status: EventStatus.ACTIVE,
          maxParticipants: 5,
        });
        prisma.joinRequest.findUnique.mockResolvedValue(existingRecord);

        await expect(createJoinRequest({ eventId, userId })).rejects.toBeInstanceOf(JoinRequestDuplicateError);
        expect(prisma.joinRequest.create).not.toHaveBeenCalled();
      })
    );
  });
});

describe('Property 25: Join Request Status Transitions', () => {
  it('allows hosts to update pending join requests to accepted or rejected', async () => {
    await fc.assert(
      fc.asyncProperty(
        fc.uuid(),
        fc.uuid(),
        fc.uuid(),
        fc.uuid(),
        fc.constantFrom(JoinRequestStatus.ACCEPTED, JoinRequestStatus.REJECTED),
        fc.integer({ min: 2, max: 12 }),
        async (joinRequestId, eventId, hostId, userId, nextStatus, maxParticipants) => {
          const prisma = getMockPrisma();
          prisma.joinRequest.findUnique.mockReset();
          prisma.joinRequest.count.mockReset();
          prisma.joinRequest.update.mockReset();

          const timestamp = new Date('2030-01-01T00:00:00.000Z');

          prisma.joinRequest.findUnique.mockResolvedValue({
            id: joinRequestId,
            eventId,
            userId,
            status: JoinRequestStatus.PENDING,
            createdAt: timestamp,
            updatedAt: timestamp,
            event: {
              id: eventId,
              hostId,
              status: EventStatus.ACTIVE,
              maxParticipants,
            },
          });

          prisma.joinRequest.count.mockResolvedValue(0);
          prisma.joinRequest.update.mockResolvedValue({
            id: joinRequestId,
            eventId,
            userId,
            status: nextStatus,
            createdAt: timestamp,
            updatedAt: timestamp,
          });

          const priorCountCalls = prisma.joinRequest.count.mock.calls.length;

          const result = await updateJoinRequestStatus({
            joinRequestId,
            hostId,
            status: nextStatus,
          });

          if (nextStatus === JoinRequestStatus.ACCEPTED) {
            expect(prisma.joinRequest.count).toHaveBeenCalledWith({
              where: {
                eventId,
                status: JoinRequestStatus.ACCEPTED,
              },
            });
          } else {
            expect(prisma.joinRequest.count.mock.calls.length).toBe(priorCountCalls);
          }

          expect(prisma.joinRequest.update).toHaveBeenCalledWith({
            where: { id: joinRequestId },
            data: { status: nextStatus },
          });
          expect(result).toEqual({
            id: joinRequestId,
            eventId,
            userId,
            status: nextStatus,
            createdAt: timestamp.toISOString(),
            updatedAt: timestamp.toISOString(),
          });
        }
      )
    );
  });
});

describe('Property 26: Max Participants Enforcement', () => {
  it('prevents creating join requests when the event has already reached its accepted limit', async () => {
    await fc.assert(
      fc.asyncProperty(fc.uuid(), fc.uuid(), async (eventId, userId) => {
        const prisma = getMockPrisma();

        prisma.event.findUnique.mockResolvedValue({
          id: eventId,
          status: EventStatus.ACTIVE,
          maxParticipants: 2,
        });
        prisma.joinRequest.findUnique.mockResolvedValue(null);
        prisma.joinRequest.count.mockResolvedValue(1);

        await expect(createJoinRequest({ eventId, userId })).rejects.toBeInstanceOf(JoinRequestEventFullError);
        expect(prisma.joinRequest.create).not.toHaveBeenCalled();
      })
    );
  });
});


describe('Join request visibility for event hosts', () => {
  it('returns serialized join requests with user information when the requester is the host', async () => {
    const prisma = getMockPrisma();
    const eventId = 'event-123';
    const hostId = 'host-456';
    const firstTimestamp = new Date('2030-01-01T00:00:00.000Z');
    const secondTimestamp = new Date('2030-01-02T00:00:00.000Z');

    prisma.event.findUnique.mockResolvedValue({
      id: eventId,
      hostId,
    });

    prisma.joinRequest.findMany.mockResolvedValue([
      {
        id: 'jr-1',
        eventId,
        userId: 'user-1',
        status: JoinRequestStatus.PENDING,
        createdAt: firstTimestamp,
        updatedAt: firstTimestamp,
        user: {
          id: 'user-1',
          email: 'user1@example.com',
          displayName: 'User One',
          photoUrl: null,
          createdAt: firstTimestamp,
        },
      },
      {
        id: 'jr-2',
        eventId,
        userId: 'user-2',
        status: JoinRequestStatus.ACCEPTED,
        createdAt: secondTimestamp,
        updatedAt: secondTimestamp,
        user: {
          id: 'user-2',
          email: 'user2@example.com',
          displayName: null,
          photoUrl: 'https://example.com/photo.png',
          createdAt: secondTimestamp,
        },
      },
    ]);

    const result = await listJoinRequestsForEvent({ eventId, hostId });

    expect(prisma.joinRequest.findMany).toHaveBeenCalledWith({
      where: { eventId },
      orderBy: { createdAt: 'asc' },
      include: {
        user: {
          select: {
            id: true,
            email: true,
            displayName: true,
            photoUrl: true,
            createdAt: true,
          },
        },
      },
    });

    expect(result).toEqual([
      {
        id: 'jr-1',
        eventId,
        userId: 'user-1',
        status: JoinRequestStatus.PENDING,
        createdAt: firstTimestamp.toISOString(),
        updatedAt: firstTimestamp.toISOString(),
        user: {
          id: 'user-1',
          email: 'user1@example.com',
          displayName: 'User One',
          photoUrl: null,
          createdAt: firstTimestamp.toISOString(),
        },
      },
      {
        id: 'jr-2',
        eventId,
        userId: 'user-2',
        status: JoinRequestStatus.ACCEPTED,
        createdAt: secondTimestamp.toISOString(),
        updatedAt: secondTimestamp.toISOString(),
        user: {
          id: 'user-2',
          email: 'user2@example.com',
          displayName: null,
          photoUrl: 'https://example.com/photo.png',
          createdAt: secondTimestamp.toISOString(),
        },
      },
    ]);
  });

  it('throws when the requester is not the event host', async () => {
    const prisma = getMockPrisma();
    prisma.event.findUnique.mockResolvedValue({
      id: 'event-123',
      hostId: 'host-actual',
    });

    await expect(
      listJoinRequestsForEvent({ eventId: 'event-123', hostId: 'host-other' })
    ).rejects.toBeInstanceOf(JoinRequestUnauthorizedError);
    expect(prisma.joinRequest.findMany).not.toHaveBeenCalled();
  });

  it('throws when the event does not exist', async () => {
    const prisma = getMockPrisma();
    prisma.event.findUnique.mockResolvedValue(null);

    await expect(
      listJoinRequestsForEvent({ eventId: 'missing-event', hostId: 'host-any' })
    ).rejects.toBeInstanceOf(JoinRequestEventNotFoundError);
    expect(prisma.joinRequest.findMany).not.toHaveBeenCalled();
  });
});
