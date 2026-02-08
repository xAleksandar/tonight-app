import { EventStatus, JoinRequestStatus, type JoinRequest } from '@/generated/prisma/client';
import { prisma } from '@/lib/prisma';

export class JoinRequestError extends Error {
  constructor(message: string) {
    super(message);
    this.name = new.target.name;
  }
}

export class JoinRequestEventNotFoundError extends JoinRequestError {}
export class JoinRequestInactiveEventError extends JoinRequestError {}
export class JoinRequestDuplicateError extends JoinRequestError {}
export class JoinRequestEventFullError extends JoinRequestError {}
export class JoinRequestNotFoundError extends JoinRequestError {}
export class JoinRequestUnauthorizedError extends JoinRequestError {}
export class JoinRequestInvalidStatusError extends JoinRequestError {}

export type SerializedJoinRequest = {
  id: string;
  eventId: string;
  userId: string;
  status: JoinRequestStatus;
  createdAt: string;
  updatedAt: string;
};

export type SerializedJoinRequestWithUser = SerializedJoinRequest & {
  user: {
    id: string;
    email: string;
    displayName: string | null;
    photoUrl: string | null;
    createdAt: string;
  };
};

export type CreateJoinRequestInput = {
  eventId: string;
  userId: string;
};

export type UpdateJoinRequestStatusInput = {
  joinRequestId: string;
  hostId: string;
  status: JoinRequestStatus;
};

export type ListJoinRequestsForEventInput = {
  eventId: string;
  hostId: string;
};

const serializeJoinRequest = (record: JoinRequest): SerializedJoinRequest => ({
  id: record.id,
  eventId: record.eventId,
  userId: record.userId,
  status: record.status,
  createdAt: record.createdAt.toISOString(),
  updatedAt: record.updatedAt.toISOString(),
});

const serializeJoinRequestWithUser = (
  record: JoinRequest & {
    user: {
      id: string;
      email: string;
      displayName: string | null;
      photoUrl: string | null;
      createdAt: Date;
    };
  }
): SerializedJoinRequestWithUser => {
  return {
    ...serializeJoinRequest(record),
    user: {
      id: record.user.id,
      email: record.user.email,
      displayName: record.user.displayName,
      photoUrl: record.user.photoUrl,
      createdAt: record.user.createdAt.toISOString(),
    },
  };
};

const calculateJoinCapacity = (maxParticipants: number) => {
  const capacity = Math.floor(maxParticipants) - 1;
  return capacity < 0 ? 0 : capacity;
};

const hasAvailableSlots = (maxParticipants: number, acceptedCount: number) => {
  return acceptedCount < calculateJoinCapacity(maxParticipants);
};

export const createJoinRequest = async (
  input: CreateJoinRequestInput
): Promise<SerializedJoinRequest> => {
  return prisma.$transaction(async (tx) => {
    const event = await tx.event.findUnique({
      where: { id: input.eventId },
      select: {
        id: true,
        status: true,
        maxParticipants: true,
      },
    });

    if (!event) {
      throw new JoinRequestEventNotFoundError('Event not found');
    }

    if (event.status !== EventStatus.ACTIVE) {
      throw new JoinRequestInactiveEventError('Event is not active');
    }

    const existing = await tx.joinRequest.findUnique({
      where: {
        eventId_userId: {
          eventId: input.eventId,
          userId: input.userId,
        },
      },
    });

    if (existing) {
      throw new JoinRequestDuplicateError('Join request already exists for this event');
    }

    const acceptedCount = await tx.joinRequest.count({
      where: {
        eventId: input.eventId,
        status: JoinRequestStatus.ACCEPTED,
      },
    });

    if (!hasAvailableSlots(event.maxParticipants, acceptedCount)) {
      throw new JoinRequestEventFullError('Event is already full');
    }

    const record = await tx.joinRequest.create({
      data: {
        eventId: input.eventId,
        userId: input.userId,
        status: JoinRequestStatus.PENDING,
      },
    });

    return serializeJoinRequest(record);
  });
};

export const updateJoinRequestStatus = async (
  input: UpdateJoinRequestStatusInput
): Promise<SerializedJoinRequest> => {
  const nextStatus = input.status;
  if (nextStatus !== JoinRequestStatus.ACCEPTED && nextStatus !== JoinRequestStatus.REJECTED) {
    throw new JoinRequestInvalidStatusError('Status must be accepted or rejected');
  }

  return prisma.$transaction(async (tx) => {
    const joinRequest = await tx.joinRequest.findUnique({
      where: { id: input.joinRequestId },
      include: {
        event: {
          select: {
            id: true,
            hostId: true,
            status: true,
            maxParticipants: true,
          },
        },
      },
    });

    if (!joinRequest) {
      throw new JoinRequestNotFoundError('Join request not found');
    }

    if (joinRequest.event.hostId !== input.hostId) {
      throw new JoinRequestUnauthorizedError('You are not allowed to update this join request');
    }

    if (nextStatus === JoinRequestStatus.ACCEPTED) {
      if (joinRequest.event.status !== EventStatus.ACTIVE) {
        throw new JoinRequestInactiveEventError('Event is not active');
      }

      if (joinRequest.status !== JoinRequestStatus.ACCEPTED) {
        const acceptedCount = await tx.joinRequest.count({
          where: {
            eventId: joinRequest.eventId,
            status: JoinRequestStatus.ACCEPTED,
          },
        });

        if (!hasAvailableSlots(joinRequest.event.maxParticipants, acceptedCount)) {
          throw new JoinRequestEventFullError('Event is already full');
        }
      }
    }

    const record = await tx.joinRequest.update({
      where: { id: joinRequest.id },
      data: { status: nextStatus },
    });

    return serializeJoinRequest(record);
  });
};

export const listJoinRequestsForEvent = async (
  input: ListJoinRequestsForEventInput
): Promise<SerializedJoinRequestWithUser[]> => {
  const event = await prisma.event.findUnique({
    where: { id: input.eventId },
    select: {
      id: true,
      hostId: true,
    },
  });

  if (!event) {
    throw new JoinRequestEventNotFoundError('Event not found');
  }

  if (event.hostId !== input.hostId) {
    throw new JoinRequestUnauthorizedError('You are not allowed to view join requests for this event');
  }

  const joinRequests = await prisma.joinRequest.findMany({
    where: { eventId: input.eventId },
    orderBy: { createdAt: 'asc' },
    include: {
      user: {
        select: {
          id: true,
          email: true,
          displayName: true,
          photoUrl: true,
          createdAt: true,
        },
      },
    },
  });

  return joinRequests.map((record) => serializeJoinRequestWithUser(record));
};
