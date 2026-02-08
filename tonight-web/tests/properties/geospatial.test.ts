import { describe, it, expect, vi, beforeEach } from 'vitest';
import fc from 'fast-check';
import { findNearbyEvents, DEFAULT_RADIUS_METERS, type NearbyEventRecord } from '@/lib/geospatial';
import { expirePastEvents } from '@/lib/event-expiration';

interface MockPrisma {
  $queryRaw: ReturnType<typeof vi.fn>;
}

type GlobalWithPrisma = typeof globalThis & { __TEST_PRISMA__?: MockPrisma };

function createMockPrisma(): MockPrisma {
  return {
    $queryRaw: vi.fn(),
  };
}

vi.mock('@/lib/prisma', () => {
  const prisma = createMockPrisma();
  (globalThis as GlobalWithPrisma).__TEST_PRISMA__ = prisma;
  return { prisma };
});

vi.mock('@/lib/event-expiration', () => ({
  expirePastEvents: vi.fn(),
}));

const mockedExpirePastEvents = vi.mocked(expirePastEvents);

const getMockPrisma = (): MockPrisma => {
  const prisma = (globalThis as GlobalWithPrisma).__TEST_PRISMA__;
  if (!prisma) {
    throw new Error('Mock Prisma is not initialized');
  }
  return prisma;
};

beforeEach(() => {
  const prisma = getMockPrisma();
  prisma.$queryRaw.mockReset();
  mockedExpirePastEvents.mockReset();
});

const finiteLatitude = () => fc.double({ min: -89.999, max: 89.999, noDefaultInfinity: true, noNaN: true });
const finiteLongitude = () => fc.double({ min: -179.999, max: 179.999, noDefaultInfinity: true, noNaN: true });
const radiusArb = () => fc.float({ min: 1, max: 50_000, noNaN: true });

const stubNearbyEvents = (distances: Array<number | string>): NearbyEventRecord[] => {
  return distances.map((distance, index) => ({
    id: `event-${index}`,
    title: `Event ${index}`,
    description: 'Mock event',
    datetime: new Date('2024-01-01T00:00:00Z'),
    locationName: 'Somewhere',
    maxParticipants: 10,
    status: 'ACTIVE',
    hostId: `host-${index}`,
    createdAt: new Date('2024-01-01T00:00:00Z'),
    updatedAt: new Date('2024-01-01T00:00:00Z'),
    distanceMeters: distance as number,
  })) as NearbyEventRecord[];
};

describe('Property 17: Expired Event Exclusion from Discovery', () => {
  it('triggers the expiration routine before executing the spatial query', async () => {
    await fc.assert(
      fc.asyncProperty(finiteLatitude(), finiteLongitude(), fc.uuid(), async (lat, lng, userId) => {
        const prisma = getMockPrisma();
        prisma.$queryRaw.mockResolvedValue([]);
        mockedExpirePastEvents.mockClear();
        prisma.$queryRaw.mockClear();

        await findNearbyEvents(lat, lng, undefined, userId);

        expect(mockedExpirePastEvents).toHaveBeenCalledTimes(1);
        const expireOrder = mockedExpirePastEvents.mock.invocationCallOrder[0] ?? 0;
        const queryOrder = prisma.$queryRaw.mock.invocationCallOrder[0] ?? Number.MAX_SAFE_INTEGER;
        expect(expireOrder).toBeLessThan(queryOrder);
      })
    );
  });
});

describe('Property 18: Radius-Based Event Discovery', () => {
  it('injects the provided radius into the spatial query fragment', async () => {
    await fc.assert(
      fc.asyncProperty(finiteLatitude(), finiteLongitude(), radiusArb(), fc.uuid(), async (lat, lng, radius, userId) => {
        const prisma = getMockPrisma();
        prisma.$queryRaw.mockClear();
        prisma.$queryRaw.mockResolvedValue([]);

        await findNearbyEvents(lat, lng, radius, userId);

        expect(prisma.$queryRaw).toHaveBeenCalledTimes(1);
        const callArgs = prisma.$queryRaw.mock.calls.at(-1) ?? [];
        const values = callArgs.slice(1);
        expect(values).toContain(radius);
      })
    );
  });
});

describe('Property 19: Default Radius Application', () => {
  it('falls back to the default radius when an invalid radius is provided', async () => {
    await fc.assert(
      fc.asyncProperty(finiteLatitude(), finiteLongitude(), fc.uuid(), async (lat, lng, userId) => {
        const prisma = getMockPrisma();
        prisma.$queryRaw.mockClear();
        prisma.$queryRaw.mockResolvedValue([]);

        await findNearbyEvents(lat, lng, null, userId);

        const callArgs = prisma.$queryRaw.mock.calls.at(-1) ?? [];
        const values = callArgs.slice(1);
        expect(values).toContain(DEFAULT_RADIUS_METERS);
      })
    );
  });
});

describe('Property 20: Distance Calculation and Inclusion', () => {
  it('returns numeric distance values regardless of database serialization', async () => {
    await fc.assert(
      fc.asyncProperty(finiteLatitude(), finiteLongitude(), fc.uuid(), async (lat, lng, userId) => {
        const prisma = getMockPrisma();
        prisma.$queryRaw.mockClear();
        const returnedDistances = ['42.5', 1234.56];
        prisma.$queryRaw.mockResolvedValue(stubNearbyEvents(returnedDistances));

        const result = await findNearbyEvents(lat, lng, undefined, userId);

        result.forEach((event, index) => {
          expect(event.distanceMeters).toBeCloseTo(Number(returnedDistances[index]));
        });
      })
    );
  });
});

describe('Property 21: Distance-Based Result Ordering', () => {
  it('sorts nearby events in ascending order of distance', async () => {
    await fc.assert(
      fc.asyncProperty(finiteLatitude(), finiteLongitude(), fc.uuid(), async (lat, lng, userId) => {
        const prisma = getMockPrisma();
        prisma.$queryRaw.mockClear();
        prisma.$queryRaw.mockResolvedValue(stubNearbyEvents([500, 50, 250]));

        const result = await findNearbyEvents(lat, lng, undefined, userId);

        const distances = result.map((event) => event.distanceMeters);
        expect(distances).toEqual([50, 250, 500]);
      })
    );
  });
});

describe('Property 32: Bidirectional Event Discovery Blocking', () => {
  it('injects a bidirectional block clause into the spatial query', async () => {
    await fc.assert(
      fc.asyncProperty(finiteLatitude(), finiteLongitude(), fc.uuid(), async (lat, lng, userId) => {
        const prisma = getMockPrisma();
        prisma.$queryRaw.mockClear();
        prisma.$queryRaw.mockResolvedValue([]);

        await findNearbyEvents(lat, lng, undefined, userId);

        const callArgs = prisma.$queryRaw.mock.calls.at(-1) ?? [];
        const strings = Array.isArray(callArgs[0]) ? (callArgs[0] as readonly string[]) : [];
        const queryText = strings.join(' ');

        expect(queryText).toContain('FROM "BlockedUser"');
        expect(queryText).toContain('b."blockerId" = ');
        expect(queryText).toContain('b."blockedId" = e."hostId"');
        expect(queryText).toContain('b."blockerId" = e."hostId"');
        expect(queryText).toContain('b."blockedId" = ');

        const values = callArgs.slice(1);
        const userIdOccurrences = values.filter((value) => value === userId).length;
        expect(userIdOccurrences).toBeGreaterThanOrEqual(2);
      })
    );
  });
});
