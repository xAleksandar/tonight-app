import { describe, it, expect, vi, beforeEach } from 'vitest';
import fc from 'fast-check';
import { createBlockRecord, BlockUserDuplicateError } from '@/lib/blocking';

interface MockPrisma {
  user: {
    findUnique: ReturnType<typeof vi.fn>;
  };
  blockedUser: {
    findUnique: ReturnType<typeof vi.fn>;
    create: ReturnType<typeof vi.fn>;
  };
}

type GlobalWithPrisma = typeof globalThis & { __TEST_PRISMA__?: MockPrisma };

function createMockPrisma(): MockPrisma {
  return {
    user: {
      findUnique: vi.fn(),
    },
    blockedUser: {
      findUnique: vi.fn(),
      create: vi.fn(),
    },
  };
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

const distinctUserPair = fc
  .tuple(fc.uuid(), fc.uuid())
  .filter(([blockerId, blockedId]) => blockerId !== blockedId);

const futureTimestamp = fc
  .integer({
    min: Date.parse('2025-01-01T00:00:00.000Z'),
    max: Date.parse('2035-12-31T23:59:59.000Z'),
  })
  .map((ms) => new Date(ms));

beforeEach(() => {
  const prisma = getMockPrisma();
  prisma.user.findUnique.mockReset();
  prisma.blockedUser.findUnique.mockReset();
  prisma.blockedUser.create.mockReset();
});

describe('Property 31: Block Record Creation', () => {
  it('creates a block record for any two distinct users', async () => {
    await fc.assert(
      fc.asyncProperty(distinctUserPair, fc.uuid(), futureTimestamp, async ([blockerId, blockedId], blockId, createdAt) => {
        const prisma = getMockPrisma();
        prisma.user.findUnique.mockResolvedValue({ id: blockedId });
        prisma.blockedUser.findUnique.mockResolvedValue(null);
        prisma.blockedUser.create.mockResolvedValue({
          id: blockId,
          blockerId,
          blockedId,
          createdAt,
        });

        const result = await createBlockRecord({ blockerId, blockedId });

        expect(prisma.blockedUser.create).toHaveBeenCalledWith({
          data: {
            blockerId,
            blockedId,
          },
        });

        expect(result).toEqual({
          id: blockId,
          blockerId,
          blockedId,
          createdAt: createdAt.toISOString(),
        });
      })
    );
  });
});

describe('Property 34: Duplicate Block Prevention', () => {
  it('rejects duplicate block attempts for any user pair', async () => {
    await fc.assert(
      fc.asyncProperty(distinctUserPair, fc.uuid(), futureTimestamp, async ([blockerId, blockedId], existingId, createdAt) => {
        const prisma = getMockPrisma();
        prisma.user.findUnique.mockResolvedValue({ id: blockedId });
        prisma.blockedUser.findUnique.mockResolvedValue({
          id: existingId,
          blockerId,
          blockedId,
          createdAt,
        });

        await expect(createBlockRecord({ blockerId, blockedId })).rejects.toBeInstanceOf(BlockUserDuplicateError);
        expect(prisma.blockedUser.create).not.toHaveBeenCalled();
      })
    );
  });
});
