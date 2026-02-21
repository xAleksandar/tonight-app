import { ReportStatus, type Report } from '@/generated/prisma/client';
import { prisma } from '@/lib/prisma';

export class ReportError extends Error {
  constructor(message: string) {
    super(message);
    this.name = new.target.name;
  }
}

export class ReportValidationError extends ReportError {}
export class ReportEventNotFoundError extends ReportError {}
export class ReportedUserNotFoundError extends ReportError {}

export type CreateReportInput = {
  reporterId: string;
  reason: string;
  description?: string | null;
  eventId?: string | null;
  reportedUserId?: string | null;
};

export type SerializedReport = {
  id: string;
  reporterId: string;
  eventId: string | null;
  reportedUserId: string | null;
  reason: string;
  description: string | null;
  status: ReportStatus;
  createdAt: string;
};

const serializeReport = (record: Report): SerializedReport => ({
  id: record.id,
  reporterId: record.reporterId,
  eventId: record.eventId,
  reportedUserId: record.reportedUserId,
  reason: record.reason,
  description: record.description,
  status: record.status,
  createdAt: record.createdAt.toISOString(),
});

const normalizeTargetId = (value?: string | null) => {
  if (typeof value !== 'string') {
    return null;
  }

  const trimmed = value.trim();
  return trimmed ? trimmed : null;
};

export const createReport = async (input: CreateReportInput): Promise<SerializedReport> => {
  const reason = input.reason?.trim();
  if (!reason) {
    throw new ReportValidationError('Reason is required');
  }

  const eventId = normalizeTargetId(input.eventId ?? null);
  const reportedUserId = normalizeTargetId(input.reportedUserId ?? null);

  if (!eventId && !reportedUserId) {
    throw new ReportValidationError('Either eventId or reportedUserId must be provided');
  }

  if (eventId && reportedUserId) {
    throw new ReportValidationError('Only one target can be reported at a time');
  }

  const description =
    typeof input.description === 'string' ? input.description.trim() || null : null;

  if (eventId) {
    const event = await prisma.event.findUnique({
      where: { id: eventId },
      select: { id: true },
    });

    if (!event) {
      throw new ReportEventNotFoundError('Event not found');
    }
  }

  if (reportedUserId) {
    const user = await prisma.user.findUnique({
      where: { id: reportedUserId },
      select: { id: true },
    });

    if (!user) {
      throw new ReportedUserNotFoundError('User not found');
    }
  }

  const report = await prisma.report.create({
    data: {
      reporterId: input.reporterId,
      eventId,
      reportedUserId,
      reason,
      description,
      status: ReportStatus.PENDING,
    },
  });

  return serializeReport(report);
};
