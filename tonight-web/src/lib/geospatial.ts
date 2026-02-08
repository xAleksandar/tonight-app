import { Prisma, EventStatus } from '@/generated/prisma/client';
import { prisma } from '@/lib/prisma';

const EARTH_SRID = 4326;
export const DEFAULT_RADIUS_METERS = 10_000;

export type NearbyEventRecord = {
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
  distanceMeters: number;
};

const assertFiniteCoordinate = (value: number, label: 'latitude' | 'longitude'): number => {
  if (!Number.isFinite(value)) {
    throw new Error(`${label} must be a finite number`);
  }

  if (label === 'latitude' && (value < -90 || value > 90)) {
    throw new Error('latitude must be between -90 and 90 degrees');
  }

  if (label === 'longitude' && (value < -180 || value > 180)) {
    throw new Error('longitude must be between -180 and 180 degrees');
  }

  return value;
};

const resolveRadius = (radiusMeters?: number | null): number => {
  if (typeof radiusMeters === 'number' && Number.isFinite(radiusMeters) && radiusMeters > 0) {
    return radiusMeters;
  }
  return DEFAULT_RADIUS_METERS;
};

const buildOriginFragment = (latitude: number, longitude: number) => {
  return Prisma.sql`ST_SetSRID(ST_MakePoint(${longitude}, ${latitude}), ${EARTH_SRID})::geography`;
};

export const findNearbyEvents = async (
  latitude: number,
  longitude: number,
  radiusMeters: number | null | undefined,
  userId: string
): Promise<NearbyEventRecord[]> => {
  if (!userId) {
    throw new Error('userId is required');
  }

  const lat = assertFiniteCoordinate(latitude, 'latitude');
  const lng = assertFiniteCoordinate(longitude, 'longitude');
  const radius = resolveRadius(radiusMeters);
  const origin = buildOriginFragment(lat, lng);

  const events = await prisma.$queryRaw<NearbyEventRecord[]>`
    SELECT
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
      ST_Distance(e."location", ${origin}) AS "distanceMeters"
    FROM "Event" e
    WHERE e."status" = 'ACTIVE'
      AND ST_DWithin(e."location", ${origin}, ${radius})
      AND NOT EXISTS (
        SELECT 1 FROM "BlockedUser" b
        WHERE (b."blockerId" = ${userId} AND b."blockedId" = e."hostId")
           OR (b."blockerId" = e."hostId" AND b."blockedId" = ${userId})
      )
    ORDER BY "distanceMeters" ASC
  `;

  return events
    .map((event) => ({
      ...event,
      distanceMeters: typeof event.distanceMeters === 'number' ? event.distanceMeters : Number(event.distanceMeters),
    }))
    .sort((a, b) => a.distanceMeters - b.distanceMeters);
};
