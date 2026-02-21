import { NextResponse } from 'next/server';

import type { AuthenticatedRouteHandler } from '@/middleware/auth';
import { requireAuth } from '@/middleware/auth';
import { fetchActiveEventSummaries, fetchProfileStats } from '@/lib/profile';
import { handleRouteError } from '@/lib/http/errors';

const ROUTE_CONTEXT = 'GET /api/profile/overview';

const getProfileOverview: AuthenticatedRouteHandler<NextResponse> = async (_request, _context, auth) => {
  try {
    const [stats, activeEvents] = await Promise.all([
      fetchProfileStats(auth.userId),
      fetchActiveEventSummaries(auth.userId),
    ]);

    return NextResponse.json({ stats, activeEvents });
  } catch (error) {
    return handleRouteError(error, ROUTE_CONTEXT, 'Unable to load profile overview');
  }
};

export const GET = requireAuth(getProfileOverview);
