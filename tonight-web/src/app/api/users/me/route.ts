import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import type { AuthenticatedRouteHandler } from '@/middleware/auth';
import { requireAuth } from '@/middleware/auth';
import { serializeUser } from '@/lib/user-serialization';
import { createErrorResponse, handleRouteError } from '@/lib/http/errors';

const DISPLAY_NAME_MIN = 2;
const DISPLAY_NAME_MAX = 64;
const PHOTO_URL_MAX = 2_000_000; // 2MB limit for base64 encoded images

type NormalizedField = {
  provided: boolean;
  value: string | null;
  error?: string;
};

const normalizeDisplayName = (value: unknown): NormalizedField => {
  if (typeof value === 'undefined') {
    return { provided: false, value: null };
  }

  if (value === null) {
    return { provided: true, value: null };
  }

  if (typeof value !== 'string') {
    return { provided: true, value: null, error: 'Display name must be a string' };
  }

  const trimmed = value.trim();
  if (trimmed.length === 0) {
    return { provided: true, value: null };
  }

  if (trimmed.length < DISPLAY_NAME_MIN || trimmed.length > DISPLAY_NAME_MAX) {
    return {
      provided: true,
      value: null,
      error: `Display name must be between ${DISPLAY_NAME_MIN} and ${DISPLAY_NAME_MAX} characters`,
    };
  }

  return { provided: true, value: trimmed };
};

const normalizePhotoUrl = (value: unknown): NormalizedField => {
  if (typeof value === 'undefined') {
    return { provided: false, value: null };
  }

  if (value === null) {
    return { provided: true, value: null };
  }

  if (typeof value !== 'string') {
    return { provided: true, value: null, error: 'Photo URL must be a string' };
  }

  const trimmed = value.trim();
  if (trimmed.length === 0) {
    return { provided: true, value: null };
  }

  if (trimmed.length > PHOTO_URL_MAX) {
    return { provided: true, value: null, error: 'Photo URL is too long' };
  }

  if (trimmed.startsWith('data:')) {
    const dataUrlPattern = /^data:image\/[a-zA-Z0-9.+-]+;base64,[A-Za-z0-9+/=]+$/;
    if (!dataUrlPattern.test(trimmed)) {
      return { provided: true, value: null, error: 'Photo data URL is invalid' };
    }
    return { provided: true, value: trimmed };
  }

  try {
    const parsed = new URL(trimmed);
    if (parsed.protocol !== 'http:' && parsed.protocol !== 'https:') {
      return { provided: true, value: null, error: 'Photo URL must use http or https' };
    }
    return { provided: true, value: trimmed };
  } catch {
    return { provided: true, value: null, error: 'Photo URL must be a valid URL' };
  }
};

const parseRequestBody = async (request: NextRequest) => {
  try {
    return (await request.json()) as Record<string, unknown>;
  } catch {
    return null;
  }
};

const ROUTE_CONTEXT = 'PATCH /api/users/me';

export const patchProfileHandler: AuthenticatedRouteHandler<NextResponse> = async (
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

  const displayNameField = normalizeDisplayName(body.displayName);
  const photoUrlField = normalizePhotoUrl(body.photoUrl);

  const errors: Record<string, string> = {};
  if (displayNameField.error) {
    errors.displayName = displayNameField.error;
  }
  if (photoUrlField.error) {
    errors.photoUrl = photoUrlField.error;
  }

  if (Object.keys(errors).length > 0) {
    return createErrorResponse({
      message: 'Invalid profile data',
      status: 400,
      context: ROUTE_CONTEXT,
      errors,
    });
  }

  const data: { displayName?: string | null; photoUrl?: string | null } = {};
  if (displayNameField.provided) {
    data.displayName = displayNameField.value;
  }
  if (photoUrlField.provided) {
    data.photoUrl = photoUrlField.value;
  }

  if (Object.keys(data).length === 0) {
    return createErrorResponse({
      message: 'No changes provided',
      status: 400,
      context: ROUTE_CONTEXT,
    });
  }

  try {
    const updatedUser = await prisma.user.update({
      where: { id: auth.userId },
      data,
    });

    return NextResponse.json({ user: serializeUser(updatedUser) });
  } catch (error) {
    if (isRecordNotFoundError(error)) {
      return createErrorResponse({
        message: 'User not found',
        status: 404,
        context: ROUTE_CONTEXT,
      });
    }

    return handleRouteError(error, ROUTE_CONTEXT, 'Unable to update profile');
  }
};

const isRecordNotFoundError = (error: unknown): error is { code: string } => {
  return Boolean(
    error &&
      typeof error === 'object' &&
      'code' in error &&
      typeof (error as { code?: unknown }).code === 'string' &&
      (error as { code?: string }).code === 'P2025'
  );
};

export const PATCH = requireAuth(patchProfileHandler);
