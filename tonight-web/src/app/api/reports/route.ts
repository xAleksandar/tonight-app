import { NextRequest, NextResponse } from 'next/server';
import type { AuthenticatedRouteHandler } from '@/middleware/auth';
import { requireAuth } from '@/middleware/auth';
import {
  createReport,
  ReportEventNotFoundError,
  ReportValidationError,
  ReportedUserNotFoundError,
} from '@/lib/reports';
import { createErrorResponse, handleRouteError } from '@/lib/http/errors';

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

const ROUTE_CONTEXT = 'POST /api/reports';

export const createReportHandler: AuthenticatedRouteHandler<NextResponse> = async (
  request,
  _context,
  auth
) => {
  const body = await parseRequestBody(request);
  if (!body) {
    return createErrorResponse({
      message: 'Invalid JSON body',
      status: 400,
      context: ROUTE_CONTEXT,
    });
  }

  const reasonField = normalizeReason(body.reason);
  if ('error' in reasonField) {
    return createErrorResponse({
      message: reasonField.error ?? 'Invalid reason',
      status: 400,
      context: ROUTE_CONTEXT,
    });
  }

  const descriptionField = normalizeDescription(body.description);
  if ('error' in descriptionField) {
    return createErrorResponse({
      message: descriptionField.error ?? 'Invalid description',
      status: 400,
      context: ROUTE_CONTEXT,
    });
  }

  const eventField = normalizeOptionalId('eventId', body.eventId);
  if ('error' in eventField) {
    return createErrorResponse({
      message: eventField.error ?? 'Invalid event ID',
      status: 400,
      context: ROUTE_CONTEXT,
    });
  }

  const reportedUserField = normalizeOptionalId('reportedUserId', body.reportedUserId);
  if ('error' in reportedUserField) {
    return createErrorResponse({
      message: reportedUserField.error ?? 'Invalid user ID',
      status: 400,
      context: ROUTE_CONTEXT,
    });
  }

  if (!eventField.value && !reportedUserField.value) {
    return createErrorResponse({
      message: 'Provide eventId or reportedUserId',
      status: 400,
      context: ROUTE_CONTEXT,
    });
  }

  if (eventField.value && reportedUserField.value) {
    return createErrorResponse({
      message: 'Choose a single target to report',
      status: 400,
      context: ROUTE_CONTEXT,
    });
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
      return createErrorResponse({
        message: error.message,
        status: 400,
        context: ROUTE_CONTEXT,
      });
    }

    if (error instanceof ReportEventNotFoundError) {
      return createErrorResponse({
        message: 'Event not found',
        status: 404,
        context: ROUTE_CONTEXT,
      });
    }

    if (error instanceof ReportedUserNotFoundError) {
      return createErrorResponse({
        message: 'User not found',
        status: 404,
        context: ROUTE_CONTEXT,
      });
    }

    return handleRouteError(error, ROUTE_CONTEXT, 'Unable to create report');
  }
};

export const POST = requireAuth(createReportHandler);
