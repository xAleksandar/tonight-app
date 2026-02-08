import { NextRequest, NextResponse } from 'next/server';
import type { AuthenticatedRouteHandler } from '@/middleware/auth';
import { requireAuth } from '@/middleware/auth';
import {
  createReport,
  ReportEventNotFoundError,
  ReportValidationError,
  ReportedUserNotFoundError,
} from '@/lib/reports';

const parseRequestBody = async (request: NextRequest) => {
  try {
    return (await request.json()) as Record<string, unknown>;
  } catch {
    return null;
  }
};

const normalizeReason = (value: unknown) => {
  if (typeof value !== 'string') {
    return { error: 'Reason must be a string' } as const;
  }

  const trimmed = value.trim();
  if (!trimmed) {
    return { error: 'Reason is required' } as const;
  }

  return { value: trimmed } as const;
};

const normalizeDescription = (value: unknown) => {
  if (value == null) {
    return { value: null } as const;
  }

  if (typeof value !== 'string') {
    return { error: 'Description must be a string' } as const;
  }

  return { value: value.trim() || null } as const;
};

const normalizeOptionalId = (label: string, value: unknown) => {
  if (value == null) {
    return { value: null } as const;
  }

  if (typeof value !== 'string') {
    return { error: `${label} must be a string` } as const;
  }

  const trimmed = value.trim();
  if (!trimmed) {
    return { error: `${label} cannot be empty` } as const;
  }

  return { value: trimmed } as const;
};

export const createReportHandler: AuthenticatedRouteHandler<NextResponse> = async (
  request,
  _context,
  auth
) => {
  const body = await parseRequestBody(request);
  if (!body) {
    return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 });
  }

  const reasonField = normalizeReason(body.reason);
  if ('error' in reasonField) {
    return NextResponse.json({ error: reasonField.error }, { status: 400 });
  }

  const descriptionField = normalizeDescription(body.description);
  if ('error' in descriptionField) {
    return NextResponse.json({ error: descriptionField.error }, { status: 400 });
  }

  const eventField = normalizeOptionalId('eventId', body.eventId);
  if ('error' in eventField) {
    return NextResponse.json({ error: eventField.error }, { status: 400 });
  }

  const reportedUserField = normalizeOptionalId('reportedUserId', body.reportedUserId);
  if ('error' in reportedUserField) {
    return NextResponse.json({ error: reportedUserField.error }, { status: 400 });
  }

  if (!eventField.value && !reportedUserField.value) {
    return NextResponse.json({ error: 'Provide eventId or reportedUserId' }, { status: 400 });
  }

  if (eventField.value && reportedUserField.value) {
    return NextResponse.json({ error: 'Choose a single target to report' }, { status: 400 });
  }

  try {
    const report = await createReport({
      reporterId: auth.userId,
      reason: reasonField.value,
      description: descriptionField.value,
      eventId: eventField.value,
      reportedUserId: reportedUserField.value,
    });

    return NextResponse.json({ report }, { status: 201 });
  } catch (error) {
    if (error instanceof ReportValidationError) {
      return NextResponse.json({ error: error.message }, { status: 400 });
    }

    if (error instanceof ReportEventNotFoundError) {
      return NextResponse.json({ error: 'Event not found' }, { status: 404 });
    }

    if (error instanceof ReportedUserNotFoundError) {
      return NextResponse.json({ error: 'User not found' }, { status: 404 });
    }

    console.error('Failed to create report', error);
    return NextResponse.json({ error: 'Unable to create report' }, { status: 500 });
  }
};

export const POST = requireAuth(createReportHandler);
