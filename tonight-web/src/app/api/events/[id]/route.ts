import { NextRequest, NextResponse } from 'next/server';
import { fetchEventById, serializeEvent } from '@/lib/events';

type RouteContext = {
  params: {
    id?: string;
  };
};

export const getEventHandler = async (_request: NextRequest, context: RouteContext) => {
  const eventId = context.params?.id;
  if (!eventId) {
    return NextResponse.json({ error: 'Event id is required' }, { status: 400 });
  }

  const record = await fetchEventById(eventId);
  if (!record) {
    return NextResponse.json({ error: 'Event not found' }, { status: 404 });
  }

  return NextResponse.json({ event: serializeEvent(record) });
};

export const GET = getEventHandler;
