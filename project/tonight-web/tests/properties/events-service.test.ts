import { describe, it, expect, vi, beforeEach } from 'vitest';
import fc from 'fast-check';
import { createEvent, buildLocationFragment } from '@/lib/events';
import { expirePastEvents } from '@/lib/event-expiration';
import { EventStatus } from '@/generated/prisma/client';

type MockPrisma = {
  $queryRaw: ReturnType<typeof vi.fn>;
  event: {
    updateMany: ReturnType<typeof vi.fn>;
  };
};

type GlobalWithPrisma = typeof globalThis & {
  __TEST_PRISMA__?: MockPrisma;
};

function createMockPrisma(): MockPrisma {
  return {
    $queryRaw: vi.fn(),
    event: {
      updateMany: vi.fn(),
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

const buildEventRecord = (overrides: Partial<Record<string, unknown>> = {}) => ({
  id: overrides.id ?? 'event-id',
  title: overrides.title ?? 'Event Title',
  description: overrides.description ?? 'Event description',
  datetime: overrides.datetime ?? new Date('2030-01-01T00:00:00Z'),
  locationName: overrides.locationName ?? 'Location',
  maxParticipants: overrides.maxParticipants ?? 4,
  status: overrides.status ?? EventStatus.ACTIVE,
  hostId: overrides.hostId ?? 'host-id',
  createdAt: overrides.createdAt ?? new Date('2030-01-01T00:00:00Z'),
  updatedAt: overrides.updatedAt ?? new Date('2030-01-01T00:00:00Z'),
  latitude: overrides.latitude ?? 1,
  longitude: overrides.longitude ?? 2,
  hostEmail: overrides.hostEmail ?? 'host@example.com',
  hostDisplayName: overrides.hostDisplayName ?? 'Host',
  hostPhotoUrl: overrides.hostPhotoUrl ?? null,
  hostCreatedAt: overrides.hostCreatedAt ?? new Date('2029-01-01T00:00:00Z'),
});

const finiteLat = () => fc.double({ min: -89.999, max: 89.999, noDefaultInfinity: true, noNaN: true });
const finiteLng = () => fc.double({ min: -179.999, max: 179.999, noDefaultInfinity: true, noNaN: true });

const coordinatesMatch = (value: unknown, expected: number) => {
  if (typeof value !== 'number') {
    return false;
  }

  if (Object.is(value, expected)) {
    return true;
  }

  const isSignedZeroPair =
    (Object.is(value, 0) && Object.is(expected, -0)) || (Object.is(value, -0) && Object.is(expected, 0));

  if (isSignedZeroPair) {
    return true;
  }

  return Math.abs(value - expected) < Number.EPSILON;
};

beforeEach(() => {
  const prisma = getMockPrisma();
  prisma.$queryRaw.mockReset();
  prisma.event.updateMany.mockReset();
});

const fragmentText = (fragment: unknown): string => {
  if (
    fragment &&
    typeof fragment === 'object' &&
    'strings' in fragment &&
    Array.isArray((fragment as { strings?: unknown }).strings)
  ) {
    return ((fragment as { strings: Array<string> }).strings).join('');
  }
  return '';
};

describe('Property 13: Location Storage as PostGIS Point', () => {
  it('constructs a geography point using ST_SetSRID with the provided coordinates', async () => {
    await fc.assert(
      fc.asyncProperty(
        finiteLat(),
        finiteLng(),
        fc.string({ minLength: 3, maxLength: 50 }),
        fc.string({ minLength: 10, maxLength: 200 }),
        fc.string({ minLength: 2, maxLength: 60 }),
        fc.integer({ min: 2, max: 20 }),
        fc.uuid(),
        async (latitude, longitude, title, description, locationName, maxParticipants, hostId) => {
          const prisma = getMockPrisma();
          const insertedId = 'event-id';
          const record = buildEventRecord({
            id: insertedId,
            latitude,
            longitude,
            title,
            description,
            locationName,
            maxParticipants,
            hostId,
          });

          prisma.$queryRaw.mockResolvedValueOnce([{ id: insertedId }]);
          prisma.$queryRaw.mockResolvedValueOnce([record]);

          const fragment = buildLocationFragment(latitude, longitude);
          const text = fragmentText(fragment);
          expect(text).toContain('ST_SetSRID');
          expect(text).toContain('ST_MakePoint');

          const result = await createEvent({
            hostId,
            title,
            description,
            datetime: record.datetime as Date,
            latitude,
            longitude,
            locationName,
            maxParticipants,
          });

          expect(result.location.latitude).toBeCloseTo(latitude);
          expect(result.location.longitude).toBeCloseTo(longitude);

          const fragmentValues =
            (fragment && typeof fragment === 'object' && 'values' in fragment && Array.isArray((fragment as { values?: unknown[] }).values)
              ? ((fragment as { values: Array<unknown> }).values ?? [])
              : []);

          expect(fragmentValues.some((param) => coordinatesMatch(param, longitude))).toBe(true);
          expect(fragmentValues.some((param) => coordinatesMatch(param, latitude))).toBe(true);
          expect(fragmentValues).toContain(4326);
        }
      )
    );
  });
});

describe('Property 16: Automatic Event Expiration', () => {
  it('marks past active events as expired relative to the provided reference date', async () => {
    await fc.assert(
      fc.asyncProperty(fc.date({ min: new Date('2020-01-01T00:00:00Z'), max: new Date('2030-01-01T00:00:00Z') }), async (referenceDate) => {
        const prisma = getMockPrisma();
        prisma.event.updateMany.mockResolvedValue({ count: 1 });

        await expirePastEvents(referenceDate);

        expect(prisma.event.updateMany).toHaveBeenCalledWith({
          where: {
            status: EventStatus.ACTIVE,
            datetime: { lt: referenceDate },
          },
          data: { status: EventStatus.EXPIRED },
        });
      })
    );
  });
});
