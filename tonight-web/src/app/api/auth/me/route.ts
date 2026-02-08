import { NextRequest, NextResponse } from 'next/server';
import type { User } from '@/generated/prisma/client';
import { prisma } from '@/lib/prisma';
import { getCurrentUser } from '@/middleware/auth';

const serializeUser = (user: User) => ({
  id: user.id,
  email: user.email,
  displayName: user.displayName,
  photoUrl: user.photoUrl,
  createdAt: user.createdAt,
});

export async function GET(request: NextRequest) {
  try {
    const auth = await getCurrentUser(request);
    if (!auth) {
      return NextResponse.json({ user: null });
    }

    const user = await prisma.user.findUnique({ where: { id: auth.userId } });
    if (!user) {
      return NextResponse.json({ user: null });
    }

    return NextResponse.json({ user: serializeUser(user) });
  } catch (error) {
    console.error('Failed to load user profile', error);
    return NextResponse.json({ user: null }, { status: 500 });
  }
}
