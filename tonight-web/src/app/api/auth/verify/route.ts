import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { generateJWT, getAuthCookieName, hashToken } from '@/lib/auth';
import { createErrorResponse, handleRouteError } from '@/lib/http/errors';

const ROUTE_CONTEXT = 'GET /api/auth/verify';

const unauthorized = (message: string, status = 400) =>
  createErrorResponse({ message, status, context: ROUTE_CONTEXT });

export async function GET(request: NextRequest) {
  try {
    const token = request.nextUrl.searchParams.get('token');
    if (!token) {
      return unauthorized('Missing token');
    }

    const hashedToken = hashToken(token);
    const magicLink = await prisma.magicLink.findUnique({
      where: { token: hashedToken },
    });

    if (!magicLink) {
      return unauthorized('Invalid token');
    }

    if (magicLink.usedAt) {
      return unauthorized('Token already used');
    }

    if (magicLink.expiresAt.getTime() <= Date.now()) {
      return unauthorized('Token expired');
    }

    const user = await prisma.user.upsert({
      where: { email: magicLink.email },
      update: {},
      create: { email: magicLink.email },
    });

    await prisma.magicLink.update({
      where: { id: magicLink.id },
      data: { usedAt: new Date(), userId: user.id },
    });

    const jwt = await generateJWT(user.id);
    const baseUrl = (() => {
      const envBase = process.env.NEXT_PUBLIC_APP_URL ?? process.env.NEXTAUTH_URL;
      if (envBase) {
        return new URL(envBase);
      }
      const url = new URL(request.url);
      const forwardedHost = request.headers.get('x-forwarded-host');
      const forwardedProto = request.headers.get('x-forwarded-proto');
      if (forwardedHost) {
        url.host = forwardedHost;
      }
      if (forwardedProto) {
        url.protocol = `${forwardedProto}:`;
      }
      return url;
    })();
    const response = NextResponse.redirect(new URL('/', baseUrl));
    const forwardedProto = request.headers.get("x-forwarded-proto");
    const isHttps = forwardedProto ? forwardedProto === "https" : request.nextUrl.protocol === "https:";
    response.cookies.set({
      name: getAuthCookieName(),
      value: jwt,
      httpOnly: true,
      sameSite: 'lax',
      secure: process.env.NODE_ENV === 'production' && isHttps,
      path: '/',
      maxAge: 60 * 60 * 24 * 7,
    });

    return response;
  } catch (error) {
    return handleRouteError(error, ROUTE_CONTEXT, 'Unexpected error');
  }
}
