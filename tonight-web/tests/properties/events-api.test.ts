import { describe, it, expect, vi, beforeEach } from 'vitest';
import fc from 'fast-check';
import { NextRequest } from 'next/server';
import { createEventHandler, EVENT_DEFAULT_MAX_PARTICIPANTS } from '@/app/api/events/route';
import { createEvent, type SerializedEvent } from '@/lib/events';
import { EventStatus } from '@/generated/prisma/client';

vi.mock('@/lib/events', () => ({
  createEvent: vi.fn(),
}));

const mockedCreateEvent = vi.mocked(createEvent);

const buildRequest = (body: Record<string, unknown>) =>
  new NextRequest('https://example.com/api/events', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });

const FUTURE_START = new Date('2030-01-01T00:00:00Z');
const FUTURE_END = new Date('2031-01-01T00:00:00Z');
const PAST_START = new Date('1970-01-01T00:00:00Z');
const PAST_END = new Date('2000-01-01T00:00:00Z');

const futureDateArb = () =>
  fc
    .integer({ min: FUTURE_START.getTime(), max: FUTURE_END.getTime() })
    .map((timestamp) => new Date(timestamp));

const pastDateArb = () =>
  fc
    .integer({ min: PAST_START.getTime(), max: PAST_END.getTime() })
    .map((timestamp) => new Date(timestamp));

const latArb = () => fc.double({ min: -89.999, max: 89.999, noDefaultInfinity: true, noNaN: true });
const lngArb = () => fc.double({ min: -179.999, max: 179.999, noDefaultInfinity: true, noNaN: true });

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

const stringWithTrim = (min: number, max: number) =>
  fc.string({ minLength: min, maxLength: max + 4 }).filter((value) => value.trim().length >= min && value.trim().length <= max);

const buildSerializedEvent = (overrides: Partial<SerializedEvent> = {}): SerializedEvent => {
  const iso = new Date().toISOString();
  return {
    id: overrides.id ?? 'event-id',
    title: overrides.title ?? 'Sample Event',
    description: overrides.description ?? 'Description',
    datetime: overrides.datetime ?? iso,
    location: overrides.location ?? { latitude: 1, longitude: 2 },
    locationName: overrides.locationName ?? 'Somewhere',
    maxParticipants: overrides.maxParticipants ?? 5,
    status: overrides.status ?? EventStatus.ACTIVE,
    host: overrides.host ?? {
      id: 'host-id',
      email: 'host@example.com',
      displayName: 'Host',
      photoUrl: null,
      createdAt: iso,
    },
    createdAt: overrides.createdAt ?? iso,
    updatedAt: overrides.updatedAt ?? iso,
  };
};

beforeEach(() => {
  mockedCreateEvent.mockReset();
});

describe('Property 12: Event Creation with All Fields', () => {
  it('sanitizes the payload and forwards it to the event service', async () => {
    await fc.assert(
      fc.asyncProperty(
        stringWithTrim(3, 50),
        stringWithTrim(10, 200),
        futureDateArb(),
        latArb(),
        lngArb(),
        stringWithTrim(2, 60),
        fc.integer({ min: 2, max: 20 }),
        fc.uuid(),
        async (title, description, datetime, latitude, longitude, locationName, maxParticipants, userId) => {
          const requestBody = {
            title: `  ${title}  `,
            description: `\n${description}\n`,
            datetime: datetime.toISOString(),
            location: {
              latitude,
              longitude,
            },
            locationName: ` ${locationName} `,
            maxParticipants,
          } satisfies Record<string, unknown>;

          const serialized = buildSerializedEvent();
          mockedCreateEvent.mockResolvedValue(serialized);
          mockedCreateEvent.mockClear();

          const response = await createEventHandler(buildRequest(requestBody), {}, { userId, token: 'token' });
          expect(response.status).toBe(201);

          const forwardedPayload = mockedCreateEvent.mock.calls[0]?.[0];
          expect(forwardedPayload).toBeDefined();
          expect(forwardedPayload).toMatchObject({
            hostId: userId,
            title: title.trim(),
            description: description.trim(),
            locationName: locationName.trim(),
            maxParticipants,
          });

          expect(forwardedPayload?.datetime).toEqual(new Date(datetime.toISOString()));
          expect(coordinatesMatch(forwardedPayload?.latitude, latitude)).toBe(true);
          expect(coordinatesMatch(forwardedPayload?.longitude, longitude)).toBe(true);

          const payload = await response.json();
          expect(payload.event).toEqual(serialized);
        }
      )
    );
  });
});

describe('Property 14: Max Participants Default Value', () => {
  it('defaults the max participants count when omitted', async () => {
    await fc.assert(
      fc.asyncProperty(
        stringWithTrim(3, 50),
        stringWithTrim(10, 200),
        futureDateArb(),
        latArb(),
        lngArb(),
        stringWithTrim(2, 60),
        fc.uuid(),
        async (title, description, datetime, latitude, longitude, locationName, userId) => {
          const requestBody = {
            title,
            description,
            datetime: datetime.toISOString(),
            location: { latitude, longitude },
            locationName,
          } satisfies Record<string, unknown>;

          const serialized = buildSerializedEvent();
          mockedCreateEvent.mockResolvedValue(serialized);
          mockedCreateEvent.mockClear();

          const response = await createEventHandler(buildRequest(requestBody), {}, { userId, token: 'token' });
          expect(response.status).toBe(201);

          expect(mockedCreateEvent).toHaveBeenCalledWith(
            expect.objectContaining({
              maxParticipants: EVENT_DEFAULT_MAX_PARTICIPANTS,
            })
          );
        }
      )
    );
  });
});

describe('Property 15: Future Datetime Validation', () => {
  it('rejects non-future datetimes', async () => {
    await fc.assert(
      fc.asyncProperty(
        stringWithTrim(3, 50),
        stringWithTrim(10, 200),
        pastDateArb(),
        latArb(),
        lngArb(),
        stringWithTrim(2, 60),
        fc.uuid(),
        async (title, description, pastDate, latitude, longitude, locationName, userId) => {
          const requestBody = {
            title,
            description,
            datetime: pastDate.toISOString(),
            location: { latitude, longitude },
            locationName,
          } satisfies Record<string, unknown>;

          mockedCreateEvent.mockClear();

          const response = await createEventHandler(buildRequest(requestBody), {}, { userId, token: 'token' });
          expect(response.status).toBe(400);
          expect(mockedCreateEvent).not.toHaveBeenCalled();

          const payload = await response.json();
          expect(payload.error).toBeDefined();
          expect(payload.errors.datetime).toContain('future');
        }
      )
    );
  });
});
