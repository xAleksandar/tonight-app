import { Prisma, EventStatus, JoinRequestStatus } from '@/generated/prisma/client';
import { prisma } from '@/lib/prisma';
import { expirePastEvents } from '@/lib/event-expiration';

const EARTH_SRID = 4326;
export const DEFAULT_RADIUS_METERS = 10_000;

export type NearbyEventRecord = {
  id: string;
  title: string;
  description: string;
  datetime: Date | string;
  locationName: string;
  maxParticipants: number;
  status: EventStatus;
  hostId: string;
  hostDisplayName: string | null;
  hostPhotoUrl: string | null;
  createdAt: Date | string;
  updatedAt: Date | string;
  distanceMeters: number | string;
  latitude: number | string;
  longitude: number | string;
  acceptedCount: number | string;
  viewerJoinRequestStatus: JoinRequestStatus | null;
  viewerHostUpdatesUnseen: number | string | null;
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
  // Defensive validation: catch any values that slip through
  if (!Number.isFinite(latitude) || !Number.isFinite(longitude)) {
    throw new Error(
      `Invalid coordinates for geometry construction: lat=${latitude}, lng=${longitude}`
    );
  }

  if (latitude < -90 || latitude > 90) {
    throw new Error(`Latitude ${latitude} out of valid range [-90, 90]`);
  }

  if (longitude < -180 || longitude > 180) {
    throw new Error(`Longitude ${longitude} out of valid range [-180, 180]`);
  }

  return Prisma.sql`ST_SetSRID(ST_MakePoint(${longitude}, ${latitude}), ${EARTH_SRID})::geography`;
};

const toDate = (value: Date | string): Date => {
  return value instanceof Date ? value : new Date(value);
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

  await expirePastEvents();

  const lat = assertFiniteCoordinate(latitude, 'latitude');
  const lng = assertFiniteCoordinate(longitude, 'longitude');
  const radius = resolveRadius(radiusMeters);

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
      u."displayName" AS "hostDisplayName",
      u."photoUrl" AS "hostPhotoUrl",
      e."createdAt",
      e."updatedAt",
      ST_Y(e."location"::geometry) AS "latitude",
      ST_X(e."location"::geometry) AS "longitude",
      ST_Distance(e."location", ST_SetSRID(ST_MakePoint(${lng}, ${lat}), ${EARTH_SRID})::geography) AS "distanceMeters",
      COALESCE(accepted."acceptedCount", 0) AS "acceptedCount",
      viewer_request."status" AS "viewerJoinRequestStatus",
      COALESCE(host_updates."unseenCount", 0) AS "viewerHostUpdatesUnseen"
    FROM "Event" e
    INNER JOIN "User" u ON u."id" = e."hostId"
    LEFT JOIN (
      SELECT "eventId", COUNT(*)::integer AS "acceptedCount"
      FROM "JoinRequest"
      WHERE "status" = 'ACCEPTED'
      GROUP BY "eventId"
    ) AS accepted ON accepted."eventId" = e."id"
    LEFT JOIN "JoinRequest" AS viewer_request
      ON viewer_request."eventId" = e."id"
     AND viewer_request."userId" = ${userId}
    LEFT JOIN LATERAL (
      SELECT COUNT(*)::integer AS "unseenCount"
      FROM "Message" m
      WHERE viewer_request."status" = 'ACCEPTED'
        AND m."joinRequestId" = viewer_request."id"
        AND m."senderId" = e."hostId"
        AND (
          viewer_request."lastSeenHostActivityAt" IS NULL
          OR m."createdAt" > viewer_request."lastSeenHostActivityAt"
        )
    ) AS host_updates ON TRUE
    WHERE e."status" = 'ACTIVE'
      AND ST_DWithin(e."location", ST_SetSRID(ST_MakePoint(${lng}, ${lat}), ${EARTH_SRID})::geography, ${radius})
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
      datetime: toDate(event.datetime),
      createdAt: toDate(event.createdAt),
      updatedAt: toDate(event.updatedAt),
      distanceMeters:
        typeof event.distanceMeters === 'number'
          ? event.distanceMeters
          : Number(event.distanceMeters),
      latitude: typeof event.latitude === 'number' ? event.latitude : Number(event.latitude),
      longitude: typeof event.longitude === 'number' ? event.longitude : Number(event.longitude),
      acceptedCount:
        typeof event.acceptedCount === 'number'
          ? event.acceptedCount
          : Number(event.acceptedCount),
      viewerHostUpdatesUnseen:
        typeof event.viewerHostUpdatesUnseen === 'number'
          ? event.viewerHostUpdatesUnseen
          : Number(event.viewerHostUpdatesUnseen ?? 0),
    }))
    .sort((a, b) => a.distanceMeters - b.distanceMeters);
};
