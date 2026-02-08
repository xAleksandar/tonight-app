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

export type SerializedJoinRequest = {
  id: string;
  eventId: string;
  userId: string;
  status: JoinRequestStatus;
  createdAt: string;
  updatedAt: string;
};

export type CreateJoinRequestInput = {
  eventId: string;
  userId: string;
};

const serializeJoinRequest = (record: JoinRequest): SerializedJoinRequest => ({
  id: record.id,
  eventId: record.eventId,
  userId: record.userId,
  status: record.status,
  createdAt: record.createdAt.toISOString(),
  updatedAt: record.updatedAt.toISOString(),
});

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
