import { cookies } from 'next/headers';
import { NextRequest, NextResponse } from 'next/server';
import { getAuthCookieName, verifyJWT } from '@/lib/auth';
import { createErrorResponse } from '@/lib/http/errors';

export interface AuthenticatedUser {
  userId: string;
  token: string;
}

const unauthorizedResponse = () =>
  createErrorResponse({
    message: 'Unauthorized',
    status: 401,
    context: 'middleware/auth',
  });

const readTokenFromCookies = async (request?: NextRequest): Promise<string | null> => {
  const cookieStore = request?.cookies ?? (await safeCookies());
  const token = cookieStore?.get(getAuthCookieName())?.value;
  return token ?? null;
};

const safeCookies = async () => {
  try {
    return await cookies();
  } catch (error) {
    return undefined;
  }
};

export const getCurrentUser = async (request?: NextRequest): Promise<AuthenticatedUser | null> => {
  const token = await readTokenFromCookies(request);
  if (!token) {
    return null;
  }

  try {
    const payload = await verifyJWT(token);
    return { userId: payload.userId, token };
  } catch (error) {
    return null;
  }
};

export type AuthenticatedRouteHandler<T> = (
  request: NextRequest,
  context: unknown,
  auth: AuthenticatedUser
) => Promise<T> | T;

export const requireAuth = <T>(handler: AuthenticatedRouteHandler<T>) => {
  return async (request: NextRequest, context?: unknown): Promise<T | NextResponse> => {
    const auth = await getCurrentUser(request);
    if (!auth) {
      return unauthorizedResponse();
    }

    return handler(request, context ?? {}, auth);
  };
};
