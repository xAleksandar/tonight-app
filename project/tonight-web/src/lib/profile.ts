import { EventStatus, JoinRequestStatus } from '@/generated/prisma/client';
import { prisma } from '@/lib/prisma';

export type ProfileStats = {
  eventsHosted: number;
  eventsJoined: number;
  peopleMet: number;
};

export type HostEventSummary = {
  id: string;
  title: string;
  datetime: string;
  locationName: string;
  status: EventStatus;
  pendingRequests: number;
  acceptedRequests: number;
};

const UPCOMING_LOOKAHEAD_MS = 1000 * 60 * 60 * 24 * 7; // 7 days

export const fetchProfileStats = async (userId: string): Promise<ProfileStats> => {
  const [eventsHosted, eventsJoined, acceptedAsHost, acceptedAsGuest] = await Promise.all([
    prisma.event.count({ where: { hostId: userId } }),
    prisma.joinRequest.count({ where: { userId, status: JoinRequestStatus.ACCEPTED } }),
    prisma.joinRequest.findMany({
      where: {
        status: JoinRequestStatus.ACCEPTED,
        event: {
          hostId: userId,
        },
      },
      select: { userId: true },
    }),
    prisma.joinRequest.findMany({
      where: {
        status: JoinRequestStatus.ACCEPTED,
        userId,
      },
      select: {
        event: {
          select: { hostId: true },
        },
      },
    }),
  ]);

  const uniquePeople = new Set<string>();
  for (const record of acceptedAsHost) {
    if (record.userId) {
      uniquePeople.add(record.userId);
    }
  }
  for (const record of acceptedAsGuest) {
    const hostId = record.event?.hostId;
    if (hostId && hostId !== userId) {
      uniquePeople.add(hostId);
    }
  }

  return {
    eventsHosted,
    eventsJoined,
    peopleMet: uniquePeople.size,
  };
};

export const fetchActiveEventSummaries = async (userId: string): Promise<HostEventSummary[]> => {
  const now = Date.now();
  const cutoff = new Date(now - 1000 * 60 * 60); // keep events from last hour in case they just ended
  const futureWindow = new Date(now + UPCOMING_LOOKAHEAD_MS);

  const events = await prisma.event.findMany({
    where: {
      hostId: userId,
      status: EventStatus.ACTIVE,
      datetime: {
        gte: cutoff,
        lte: futureWindow,
      },
    },
    orderBy: {
      datetime: 'asc',
    },
    take: 5,
    select: {
      id: true,
      title: true,
      datetime: true,
      locationName: true,
      status: true,
    },
  });

  if (events.length === 0) {
    return [];
  }

  const eventIds = events.map((event) => event.id);
  const joinRequests = await prisma.joinRequest.findMany({
    where: { eventId: { in: eventIds } },
    select: {
      eventId: true,
      status: true,
    },
  });

  const summaryMap = new Map<string, { pending: number; accepted: number }>();
  for (const eventId of eventIds) {
    summaryMap.set(eventId, { pending: 0, accepted: 0 });
  }

  for (const request of joinRequests) {
    const summary = summaryMap.get(request.eventId);
    if (!summary) continue;
    if (request.status === JoinRequestStatus.PENDING) {
      summary.pending += 1;
    } else if (request.status === JoinRequestStatus.ACCEPTED) {
      summary.accepted += 1;
    }
  }

  return events.map((event) => {
    const summary = summaryMap.get(event.id) ?? { pending: 0, accepted: 0 };
    return {
      id: event.id,
      title: event.title,
      datetime: event.datetime.toISOString(),
      locationName: event.locationName,
      status: event.status,
      pendingRequests: summary.pending,
      acceptedRequests: summary.accepted,
    };
  });
};
