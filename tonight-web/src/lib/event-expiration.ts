import { EventStatus } from '@/generated/prisma/client';
import { prisma } from '@/lib/prisma';

export const expirePastEvents = async (referenceDate: Date = new Date()) => {
  return prisma.event.updateMany({
    where: {
      status: EventStatus.ACTIVE,
      datetime: {
        lt: referenceDate,
      },
    },
    data: {
      status: EventStatus.EXPIRED,
    },
  });
};
