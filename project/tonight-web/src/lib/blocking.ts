import { prisma } from '@/lib/prisma';

export class BlockUserError extends Error {
  constructor(message: string) {
    super(message);
    this.name = new.target.name;
  }
}

export class BlockUserValidationError extends BlockUserError {}
export class BlockUserDuplicateError extends BlockUserError {}
export class BlockUserSelfBlockError extends BlockUserError {}
export class BlockUserTargetNotFoundError extends BlockUserError {}

export type CreateBlockInput = {
  blockerId: string;
  blockedId: string;
};

export type SerializedBlockRecord = {
  id: string;
  blockerId: string;
  blockedId: string;
  createdAt: string;
};

const serializeBlockRecord = (record: {
  id: string;
  blockerId: string;
  blockedId: string;
  createdAt: Date;
}): SerializedBlockRecord => ({
  id: record.id,
  blockerId: record.blockerId,
  blockedId: record.blockedId,
  createdAt: record.createdAt.toISOString(),
});

export const createBlockRecord = async (
  input: CreateBlockInput
): Promise<SerializedBlockRecord> => {
  if (!input.blockerId || !input.blockedId) {
    throw new BlockUserValidationError('Both blocker and blocked ids are required');
  }

  if (input.blockerId === input.blockedId) {
    throw new BlockUserSelfBlockError('You cannot block yourself');
  }

  const targetUser = await prisma.user.findUnique({
    where: { id: input.blockedId },
    select: { id: true },
  });

  if (!targetUser) {
    throw new BlockUserTargetNotFoundError('User not found');
  }

  const existing = await prisma.blockedUser.findUnique({
    where: {
      blockerId_blockedId: {
        blockerId: input.blockerId,
        blockedId: input.blockedId,
      },
    },
  });

  if (existing) {
    throw new BlockUserDuplicateError('User already blocked');
  }

  const created = await prisma.blockedUser.create({
    data: {
      blockerId: input.blockerId,
      blockedId: input.blockedId,
    },
  });

  return serializeBlockRecord(created);
};
