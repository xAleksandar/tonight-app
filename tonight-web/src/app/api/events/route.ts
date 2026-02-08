import { NextRequest, NextResponse } from 'next/server';
import type { AuthenticatedRouteHandler } from '@/middleware/auth';
import { requireAuth } from '@/middleware/auth';
import { createEvent } from '@/lib/events';

const TITLE_MIN = 3;
const TITLE_MAX = 120;
const DESCRIPTION_MIN = 1;
const DESCRIPTION_MAX = 2000;
const LOCATION_NAME_MIN = 2;
const LOCATION_NAME_MAX = 120;
const MAX_PARTICIPANTS_MIN = 2;
const MAX_PARTICIPANTS_MAX = 50;
export const EVENT_DEFAULT_MAX_PARTICIPANTS = 2;

const parseJson = async (request: NextRequest) => {
  try {
    return (await request.json()) as Record<string, unknown>;
  } catch {
    return null;
  }
};

const isFiniteNumber = (value: unknown): value is number =>
  typeof value === 'number' && Number.isFinite(value);

const parseDate = (value: unknown): Date | null => {
  if (typeof value !== 'string' && typeof value !== 'number') {
    return null;
  }
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    return null;
  }
  return date;
};

const normalizeString = (value: unknown, min: number, max: number, label: string) => {
  if (typeof value !== 'string') {
    return { error: `${label} must be a string` } as const;
  }

  const trimmed = value.trim();
  if (trimmed.length < min || trimmed.length > max) {
    return { error: `${label} must be between ${min} and ${max} characters` } as const;
  }

  return { value: trimmed } as const;
};

type NormalizedPayload = {
  title: string;
  description: string;
  datetime: Date;
  latitude: number;
  longitude: number;
  locationName: string;
  maxParticipants: number;
};

type ValidationResult =
  | { ok: true; data: NormalizedPayload }
  | { ok: false; errors: Record<string, string> };

const normalizeLocation = (value: unknown) => {
  if (!value || typeof value !== 'object') {
    return { error: 'Location must be an object with latitude and longitude' } as const;
  }

  const latitude = (value as Record<string, unknown>).latitude;
  const longitude = (value as Record<string, unknown>).longitude;

  if (!isFiniteNumber(latitude) || latitude < -90 || latitude > 90) {
    return { error: 'Latitude must be a number between -90 and 90' } as const;
  }

  if (!isFiniteNumber(longitude) || longitude < -180 || longitude > 180) {
    return { error: 'Longitude must be a number between -180 and 180' } as const;
  }

  return { value: { latitude, longitude } } as const;
};

const normalizeMaxParticipants = (value: unknown) => {
  if (typeof value === 'undefined' || value === null) {
    return { value: EVENT_DEFAULT_MAX_PARTICIPANTS } as const;
  }

  if (!isFiniteNumber(value)) {
    return { error: 'maxParticipants must be a finite number' } as const;
  }

  const rounded = Math.floor(value);
  if (rounded !== value) {
    return { error: 'maxParticipants must be an integer' } as const;
  }

  if (rounded < MAX_PARTICIPANTS_MIN || rounded > MAX_PARTICIPANTS_MAX) {
    return {
      error: `maxParticipants must be between ${MAX_PARTICIPANTS_MIN} and ${MAX_PARTICIPANTS_MAX}`,
    } as const;
  }

  return { value: rounded } as const;
};

export const validateEventPayload = (body: Record<string, unknown>): ValidationResult => {
  const errors: Record<string, string> = {};

  const titleField = normalizeString(body.title, TITLE_MIN, TITLE_MAX, 'Title');
  if ('error' in titleField) {
    errors.title = titleField.error;
  }
  const titleValue = 'error' in titleField ? null : titleField.value;

  const descriptionField = normalizeString(body.description, DESCRIPTION_MIN, DESCRIPTION_MAX, 'Description');
  if ('error' in descriptionField) {
    errors.description = descriptionField.error;
  }
  const descriptionValue = 'error' in descriptionField ? null : descriptionField.value;

  const date = parseDate(body.datetime);
  if (!date) {
    errors.datetime = 'Datetime must be a valid ISO string or timestamp';
  } else if (date.getTime() <= Date.now()) {
    errors.datetime = 'Event datetime must be in the future';
  }

  const locationField = normalizeLocation(body.location);
  if ('error' in locationField) {
    errors.location = locationField.error;
  }
  const locationValue = 'value' in locationField ? locationField.value : null;

  const locationNameField = normalizeString(
    body.locationName ?? '',
    LOCATION_NAME_MIN,
    LOCATION_NAME_MAX,
    'Location name'
  );
  if ('error' in locationNameField) {
    errors.locationName = locationNameField.error;
  }
  const locationNameValue = 'error' in locationNameField ? null : locationNameField.value;

  const maxParticipantsField = normalizeMaxParticipants(body.maxParticipants);
  if ('error' in maxParticipantsField) {
    errors.maxParticipants = maxParticipantsField.error;
  }
  const maxParticipantsValue = 'error' in maxParticipantsField ? null : maxParticipantsField.value;

  if (Object.keys(errors).length > 0 || !titleValue || !descriptionValue || !locationValue || !locationNameValue || maxParticipantsValue == null || !date) {
    return { ok: false, errors };
  }

  return {
    ok: true,
    data: {
      title: titleValue,
      description: descriptionValue,
      datetime: date,
      latitude: locationValue.latitude,
      longitude: locationValue.longitude,
      locationName: locationNameValue,
      maxParticipants: maxParticipantsValue,
    },
  };
};

export const createEventHandler: AuthenticatedRouteHandler<NextResponse> = async (request, _context, auth) => {
  const body = await parseJson(request);
  if (!body) {
    return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 });
  }

  const validation = validateEventPayload(body);
  if (!validation.ok) {
    return NextResponse.json({ error: 'Invalid event data', errors: validation.errors }, { status: 400 });
  }

  try {
    const event = await createEvent({
      hostId: auth.userId,
      ...validation.data,
    });

    return NextResponse.json({ event }, { status: 201 });
  } catch (error) {
    console.error('Failed to create event', error);
    return NextResponse.json({ error: 'Unable to create event' }, { status: 500 });
  }
};

export const POST = requireAuth(createEventHandler);
