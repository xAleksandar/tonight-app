import { Prisma, EventStatus } from '@/generated/prisma/client';
import { prisma } from '@/lib/prisma';
import { createId } from '@paralleldrive/cuid2';

const EARTH_SRID = 4326;

export const buildLocationFragment = (latitude: number, longitude: number) => {
  return Prisma.sql`
    ST_SetSRID(ST_MakePoint(${longitude}, ${latitude}), ${EARTH_SRID})::geography
  `;
};

export type EventRecordWithHost = {
  id: string;
  title: string;
  description: string;
  datetime: Date;
  locationName: string;
  maxParticipants: number;
  status: EventStatus;
  hostId: string;
  createdAt: Date;
  updatedAt: Date;
  latitude: number | string;
  longitude: number | string;
  hostEmail: string;
  hostDisplayName: string | null;
  hostPhotoUrl: string | null;
  hostCreatedAt: Date;
};

export type SerializedEvent = {
  id: string;
  title: string;
  description: string;
  datetime: string;
  location: {
    latitude: number;
    longitude: number;
  };
  locationName: string;
  maxParticipants: number;
  status: EventStatus;
  host: {
    id: string;
    email: string;
    displayName: string | null;
    photoUrl: string | null;
    createdAt: string;
  };
  createdAt: string;
  updatedAt: string;
};

export type CreateEventInput = {
  hostId: string;
  title: string;
  description: string;
  datetime: Date;
  latitude: number;
  longitude: number;
  locationName: string;
  maxParticipants: number;
};

const EVENT_SELECT_FRAGMENT = Prisma.sql`
  e."id",
  e."title",
  e."description",
  e."datetime",
  e."locationName",
  e."maxParticipants",
  e."status",
  e."hostId",
  e."createdAt",
  e."updatedAt",
  ST_Y(e."location"::geometry) AS "latitude",
  ST_X(e."location"::geometry) AS "longitude",
  u."email" AS "hostEmail",
  u."displayName" AS "hostDisplayName",
  u."photoUrl" AS "hostPhotoUrl",
  u."createdAt" AS "hostCreatedAt"
`;

const toNumber = (value: number | string): number => {
  return typeof value === 'number' ? value : Number(value);
};

export const fetchEventById = async (eventId: string): Promise<EventRecordWithHost | null> => {
  const records = await prisma.$queryRaw<EventRecordWithHost[]>`
    SELECT ${EVENT_SELECT_FRAGMENT}
    FROM "Event" e
    JOIN "User" u ON u."id" = e."hostId"
    WHERE e."id" = ${eventId}
    LIMIT 1
  `;

  return records[0] ?? null;
};

export const serializeEvent = (record: EventRecordWithHost): SerializedEvent => {
  return {
    id: record.id,
    title: record.title,
    description: record.description,
    datetime: record.datetime.toISOString(),
    location: {
      latitude: toNumber(record.latitude),
      longitude: toNumber(record.longitude),
    },
    locationName: record.locationName,
    maxParticipants: record.maxParticipants,
    status: record.status,
    host: {
      id: record.hostId,
      email: record.hostEmail,
      displayName: record.hostDisplayName,
      photoUrl: record.hostPhotoUrl,
      createdAt: record.hostCreatedAt.toISOString(),
    },
    createdAt: record.createdAt.toISOString(),
    updatedAt: record.updatedAt.toISOString(),
  };
};

export const createEvent = async (input: CreateEventInput): Promise<SerializedEvent> => {
  const locationFragment = buildLocationFragment(input.latitude, input.longitude);
  const eventId = createId();
  const now = new Date();

  const inserted = await prisma.$queryRaw<Array<{ id: string }>>`
    INSERT INTO "Event" (
      "id",
      "title",
      "description",
      "datetime",
      "location",
      "locationName",
      "maxParticipants",
      "status",
      "hostId",
      "createdAt",
      "updatedAt"
    )
    VALUES (
      ${eventId},
      ${input.title},
      ${input.description},
      ${input.datetime},
      ${locationFragment},
      ${input.locationName},
      ${input.maxParticipants},
      ${EventStatus.ACTIVE},
      ${input.hostId},
      ${now},
      ${now}
    )
    RETURNING "id"
  `;

  if (!inserted[0]?.id) {
    throw new Error('Failed to create event');
  }

  const record = await fetchEventById(eventId);
  if (!record) {
    throw new Error('Created event not found');
  }

  return serializeEvent(record);
};
