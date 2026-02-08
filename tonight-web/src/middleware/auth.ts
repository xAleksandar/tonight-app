import { cookies } from 'next/headers';
import { NextRequest, NextResponse } from 'next/server';
import { getAuthCookieName, verifyJWT } from '@/lib/auth';

export interface AuthenticatedUser {
  userId: string;
  token: string;
}

const unauthorizedResponse = () => NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

const readTokenFromCookies = (request?: NextRequest): string | null => {
  const cookieStore = request?.cookies ?? safeCookies();
  const token = cookieStore?.get(getAuthCookieName())?.value;
  return token ?? null;
};

const safeCookies = () => {
  try {
    return cookies();
  } catch (error) {
    return undefined;
  }
};

export const getCurrentUser = async (request?: NextRequest): Promise<AuthenticatedUser | null> => {
  const token = readTokenFromCookies(request);
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
