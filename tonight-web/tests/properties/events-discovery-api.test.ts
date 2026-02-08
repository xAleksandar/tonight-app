import { describe, it, expect, vi, beforeEach } from 'vitest';
import fc from 'fast-check';
import { NextRequest } from 'next/server';
import { getNearbyEventsHandler } from '@/app/api/events/nearby/route';
import { findNearbyEvents, DEFAULT_RADIUS_METERS, type NearbyEventRecord } from '@/lib/geospatial';
import { EventStatus } from '@/generated/prisma/client';

vi.mock('@/lib/geospatial', () => {
  return {
    DEFAULT_RADIUS_METERS: 10_000,
    findNearbyEvents: vi.fn(),
  };
});

const mockedFindNearbyEvents = vi.mocked(findNearbyEvents);

const buildRequest = (params: Record<string, string | number | undefined>) => {
  const url = new URL('https://example.com/api/events/nearby');
  Object.entries(params).forEach(([key, value]) => {
    if (typeof value !== 'undefined') {
      url.searchParams.set(key, String(value));
    }
  });
  return new NextRequest(url.toString());
};

const latArb = () => fc.double({ min: -89.999, max: 89.999, noDefaultInfinity: true, noNaN: true });
const lngArb = () => fc.double({ min: -179.999, max: 179.999, noDefaultInfinity: true, noNaN: true });
const radiusArb = () => fc.double({ min: 1, max: 100_000, noDefaultInfinity: true, noNaN: true });

const buildNearbyEventRecord = (overrides: Partial<NearbyEventRecord> = {}): NearbyEventRecord => {
  const now = new Date('2030-01-01T00:00:00.000Z');
  return {
    id: overrides.id ?? 'event-id',
    title: overrides.title ?? 'Sample Event',
    description: overrides.description ?? 'Description',
    datetime: overrides.datetime ?? now,
    locationName: overrides.locationName ?? 'Somewhere',
    maxParticipants: overrides.maxParticipants ?? 5,
    status: overrides.status ?? EventStatus.ACTIVE,
    hostId: overrides.hostId ?? 'host-id',
    createdAt: overrides.createdAt ?? now,
    updatedAt: overrides.updatedAt ?? now,
    distanceMeters: overrides.distanceMeters ?? 123,
    latitude: overrides.latitude ?? 37.7749,
    longitude: overrides.longitude ?? -122.4194,
  };
};

const numbersMatch = (actual: unknown, expected: number) => {
  if (typeof actual !== 'number') {
    return false;
  }
  if (Object.is(actual, expected)) {
    return true;
  }
  return Math.abs(actual - expected) < Number.EPSILON;
};

const expectLastCallToMatch = (lat: number, lng: number, radius: number, userId: string) => {
  const lastCall = mockedFindNearbyEvents.mock.calls.at(-1);
  expect(lastCall).toBeDefined();
  const [calledLat, calledLng, calledRadius, calledUserId] = lastCall ?? [];

  expect(numbersMatch(calledLat, lat)).toBe(true);
  expect(numbersMatch(calledLng, lng)).toBe(true);
  expect(calledRadius).toBe(radius);
  expect(calledUserId).toBe(userId);
};

beforeEach(() => {
  mockedFindNearbyEvents.mockReset();
});

describe('Event discovery API', () => {
  it('forwards coordinates, radius, and user ID to the geospatial service', async () => {
    await fc.assert(
      fc.asyncProperty(latArb(), lngArb(), radiusArb(), fc.uuid(), async (lat, lng, radius, userId) => {
        mockedFindNearbyEvents.mockClear();
        const request = buildRequest({ lat, lng, radius });
        const record = buildNearbyEventRecord({ distanceMeters: 456.78 });
        mockedFindNearbyEvents.mockResolvedValue([record]);

        const response = await getNearbyEventsHandler(request, {}, { userId, token: 'token' });
        expect(response.status).toBe(200);
        expect(mockedFindNearbyEvents).toHaveBeenCalledTimes(1);
        expectLastCallToMatch(lat, lng, radius, userId);

        const payload = await response.json();
        expect(payload.events).toHaveLength(1);
        expect(payload.events[0]).toMatchObject({
          id: record.id,
          distanceMeters: record.distanceMeters,
          datetime: record.datetime.toISOString(),
          createdAt: record.createdAt.toISOString(),
          updatedAt: record.updatedAt.toISOString(),
          location: {
            latitude: record.latitude,
            longitude: record.longitude,
          },
        });
      })
    );
  });

  it('defaults the radius to the configured fallback when missing', async () => {
    await fc.assert(
      fc.asyncProperty(latArb(), lngArb(), fc.uuid(), async (lat, lng, userId) => {
        mockedFindNearbyEvents.mockClear();
        const request = buildRequest({ lat, lng });
        mockedFindNearbyEvents.mockResolvedValue([]);

        const response = await getNearbyEventsHandler(request, {}, { userId, token: 'token' });
        expect(response.status).toBe(200);
        expect(mockedFindNearbyEvents).toHaveBeenCalledTimes(1);
        expectLastCallToMatch(lat, lng, DEFAULT_RADIUS_METERS, userId);
      })
    );
  });

  it('defaults the radius when the provided value is invalid', async () => {
    await fc.assert(
      fc.asyncProperty(latArb(), lngArb(), fc.uuid(), async (lat, lng, userId) => {
        mockedFindNearbyEvents.mockClear();
        const request = buildRequest({ lat, lng, radius: 'not-a-number' });
        mockedFindNearbyEvents.mockResolvedValue([]);

        const response = await getNearbyEventsHandler(request, {}, { userId, token: 'token' });
        expect(response.status).toBe(200);
        expect(mockedFindNearbyEvents).toHaveBeenCalledTimes(1);
        expectLastCallToMatch(lat, lng, DEFAULT_RADIUS_METERS, userId);
      })
    );
  });

  it('rejects requests missing coordinates or containing out-of-range values', async () => {
    const request = buildRequest({ lng: 10 });
    const response = await getNearbyEventsHandler(request, {}, { userId: 'user', token: 'token' });
    expect(response.status).toBe(400);
    expect(mockedFindNearbyEvents).not.toHaveBeenCalled();

    const invalidLat = buildRequest({ lat: 200, lng: 10 });
    const invalidResponse = await getNearbyEventsHandler(invalidLat, {}, { userId: 'user', token: 'token' });
    expect(invalidResponse.status).toBe(400);
    expect(mockedFindNearbyEvents).not.toHaveBeenCalled();
  });

  it('surfaces server errors from the geospatial layer as 500 responses', async () => {
    await fc.assert(
      fc.asyncProperty(latArb(), lngArb(), fc.uuid(), async (lat, lng, userId) => {
        mockedFindNearbyEvents.mockClear();
        const request = buildRequest({ lat, lng });
        mockedFindNearbyEvents.mockRejectedValue(new Error('boom'));

        const response = await getNearbyEventsHandler(request, {}, { userId, token: 'token' });
        expect(response.status).toBe(500);
      })
    );
  });
});
