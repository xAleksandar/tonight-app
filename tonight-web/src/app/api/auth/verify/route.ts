import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { generateJWT, getAuthCookieName, hashToken } from '@/lib/auth';

const unauthorized = (message: string, status = 400) =>
  NextResponse.json({ error: message }, { status });

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
    const response = NextResponse.redirect(new URL('/', request.url));
    response.cookies.set({
      name: getAuthCookieName(),
      value: jwt,
      httpOnly: true,
      sameSite: 'lax',
      secure: process.env.NODE_ENV === 'production',
      path: '/',
      maxAge: 60 * 60 * 24 * 7,
    });

    return response;
  } catch (error) {
    console.error('Failed to verify magic link', error);
    return NextResponse.json({ error: 'Unexpected error' }, { status: 500 });
  }
}
