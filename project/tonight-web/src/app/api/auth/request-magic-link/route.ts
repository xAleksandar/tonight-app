import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import {
  computeMagicLinkExpiration,
  generateMagicLinkToken,
  hashToken,
} from '@/lib/auth';
import { sendMagicLink } from '@/lib/email';
import { createErrorResponse, handleRouteError } from '@/lib/http/errors';

const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

const normalizeEmail = (email: string) => email.trim().toLowerCase();

const ROUTE_CONTEXT = 'POST /api/auth/request-magic-link';

const invalidEmailResponse = () =>
  createErrorResponse({ message: 'Invalid email address', status: 400, context: ROUTE_CONTEXT });

const parseBody = async (request: Request): Promise<Record<string, unknown>> => {
  try {
    return (await request.json()) as Record<string, unknown>;
  } catch {
    return {};
  }
};

export async function POST(request: Request) {
  try {
    const body = await parseBody(request);
    const inputEmail = typeof body.email === 'string' ? body.email : '';
    const email = normalizeEmail(inputEmail);

    if (!EMAIL_REGEX.test(email)) {
      return invalidEmailResponse();
    }

    await prisma.magicLink.deleteMany({
      where: {
        email,
        usedAt: null,
      },
    });

    const existingUser = await prisma.user.findUnique({ where: { email } });

    const token = generateMagicLinkToken();
    const hashedToken = hashToken(token);
    const expiresAt = computeMagicLinkExpiration();

    await prisma.magicLink.create({
      data: {
        token: hashedToken,
        email,
        userId: existingUser?.id ?? null,
        expiresAt,
      },
    });

    await sendMagicLink(email, token);

    // In development, return the magic link URL for direct login
    if (process.env.NODE_ENV === 'development') {
      const baseUrl = process.env.NEXT_PUBLIC_APP_URL ?? 'http://localhost:3000';
      const magicLinkUrl = `${baseUrl}/auth/verify?token=${encodeURIComponent(token)}`;
      return NextResponse.json({ ok: true, magicLinkUrl });
    }

    return NextResponse.json({ ok: true });
  } catch (error) {
    return handleRouteError(error, ROUTE_CONTEXT, 'Unable to process request');
  }
}
