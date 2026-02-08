import { NextRequest, NextResponse } from 'next/server';
import { fetchEventById, serializeEvent } from '@/lib/events';
import { createErrorResponse, handleRouteError } from '@/lib/http/errors';

type RouteContext = {
  params: {
    id?: string;
  };
};

const ROUTE_CONTEXT = 'GET /api/events/[id]';

export const getEventHandler = async (_request: NextRequest, context: RouteContext) => {
  const eventId = context.params?.id;
  if (!eventId) {
    return createErrorResponse({
      message: 'Event id is required',
      status: 400,
      context: ROUTE_CONTEXT,
    });
  }

  try {
    const record = await fetchEventById(eventId);
    if (!record) {
      return createErrorResponse({
        message: 'Event not found',
        status: 404,
        context: ROUTE_CONTEXT,
      });
    }

    return NextResponse.json({ event: serializeEvent(record) });
  } catch (error) {
    return handleRouteError(error, ROUTE_CONTEXT, 'Unable to fetch event');
  }
};

export const GET = getEventHandler;
