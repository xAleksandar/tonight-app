import { NextRequest, NextResponse } from 'next/server';
import { serializeUser } from '@/lib/user-serialization';
import { prisma } from '@/lib/prisma';
import { getCurrentUser } from '@/middleware/auth';
import { handleRouteError } from '@/lib/http/errors';

const ROUTE_CONTEXT = 'GET /api/auth/me';

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
    return handleRouteError(error, ROUTE_CONTEXT, 'Unable to load session data');
  }
}
