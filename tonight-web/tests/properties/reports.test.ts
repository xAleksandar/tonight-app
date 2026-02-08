import { describe, it, expect, vi, beforeEach } from 'vitest';
import fc from 'fast-check';
import { createReport } from '@/lib/reports';
import { ReportStatus } from '@/generated/prisma/client';

interface MockPrisma {
  event: {
    findUnique: ReturnType<typeof vi.fn>;
  };
  user: {
    findUnique: ReturnType<typeof vi.fn>;
  };
  report: {
    create: ReturnType<typeof vi.fn>;
  };
}

type GlobalWithPrisma = typeof globalThis & { __TEST_PRISMA__?: MockPrisma };

function createMockPrisma(): MockPrisma {
  return {
    event: {
      findUnique: vi.fn(),
    },
    user: {
      findUnique: vi.fn(),
    },
    report: {
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

const whitespaceArb = fc.array(fc.constantFrom(' ', '\t', '\n'), { maxLength: 3 }).map((chars) => chars.join(''));
const nonEmptyCore = fc.string({ minLength: 1, maxLength: 200 }).filter((value) => value.trim().length > 0);
const reasonArb = fc.tuple(whitespaceArb, nonEmptyCore, whitespaceArb).map(([prefix, core, suffix]) => `${prefix}${core}${suffix}`);

const descriptionArb = fc.oneof(
  fc.constant(undefined),
  fc.constant(null),
  fc.tuple(whitespaceArb, fc.string({ maxLength: 300 }), whitespaceArb).map(([prefix, body, suffix]) => `${prefix}${body}${suffix}`)
);

const reportTargetArb = fc.oneof(
  fc.record({
    type: fc.constant<'event'>('event'),
    eventId: fc.uuid(),
    reportedUserId: fc.constant(null),
  }),
  fc.record({
    type: fc.constant<'user'>('user'),
    eventId: fc.constant(null),
    reportedUserId: fc.uuid(),
  })
);

const creationDateArb = fc.date({ min: new Date('2020-01-01T00:00:00.000Z'), max: new Date('2035-12-31T23:59:59.999Z') });

beforeEach(() => {
  const prisma = getMockPrisma();
  prisma.event.findUnique.mockReset();
  prisma.user.findUnique.mockReset();
  prisma.report.create.mockReset();
});

describe('Property 35: Report Creation Round Trip', () => {
  it('persists pending reports for any valid target and serializes the result', async () => {
    await fc.assert(
      fc.asyncProperty(
        fc.uuid(),
        reportTargetArb,
        reasonArb,
        descriptionArb,
        fc.uuid(),
        creationDateArb,
        async (reporterId, target, reasonInput, descriptionInput, reportId, createdAt) => {
          const prisma = getMockPrisma();

          const eventId = target.type === 'event' ? target.eventId : null;
          const reportedUserId = target.type === 'user' ? target.reportedUserId : null;
          const trimmedReason = reasonInput.trim();
          const normalizedDescription =
            typeof descriptionInput === 'string' ? descriptionInput.trim() || null : null;

          if (eventId) {
            prisma.event.findUnique.mockResolvedValue({ id: eventId });
          }

          if (reportedUserId) {
            prisma.user.findUnique.mockResolvedValue({ id: reportedUserId });
          }

          prisma.report.create.mockResolvedValue({
            id: reportId,
            reporterId,
            eventId,
            reportedUserId,
            reason: trimmedReason,
            description: normalizedDescription,
            status: ReportStatus.PENDING,
            createdAt,
          });

          const result = await createReport({
            reporterId,
            eventId,
            reportedUserId,
            reason: reasonInput,
            description: descriptionInput,
          });

          if (eventId) {
            expect(prisma.event.findUnique).toHaveBeenCalledWith({
              where: { id: eventId },
              select: { id: true },
            });
          }

          if (reportedUserId) {
            expect(prisma.user.findUnique).toHaveBeenCalledWith({
              where: { id: reportedUserId },
              select: { id: true },
            });
          }

          expect(prisma.report.create).toHaveBeenCalledWith({
            data: {
              reporterId,
              eventId,
              reportedUserId,
              reason: trimmedReason,
              description: normalizedDescription,
              status: ReportStatus.PENDING,
            },
          });

          expect(result).toEqual({
            id: reportId,
            reporterId,
            eventId,
            reportedUserId,
            reason: trimmedReason,
            description: normalizedDescription,
            status: ReportStatus.PENDING,
            createdAt: createdAt.toISOString(),
          });
        }
      )
    );
  });
});
