import { describe, it, beforeAll, expect } from 'vitest';
import fc from 'fast-check';
import { NextResponse, NextRequest } from 'next/server';
import { generateJWT } from '@/lib/auth';
import { requireAuth } from '@/middleware/auth';

beforeAll(() => {
  process.env.NEXTAUTH_SECRET = process.env.NEXTAUTH_SECRET ?? 'test-secret';
});

const createRequest = (token?: string) => {
  const request = {
    cookies: {
      get: (_key: string) => (token ? { name: _key, value: token } : undefined),
    },
  } as unknown as NextRequest;

  return request;
};

describe('Property 8: Protected Endpoint Authentication', () => {
  it('rejects requests lacking a valid authentication token', async () => {
    const protectedHandler = requireAuth((_req, _ctx, auth) =>
      NextResponse.json({ userId: auth.userId })
    );

    const response = await protectedHandler(createRequest(), {});
    expect(response.status).toBe(401);
  });

  it('allows requests containing a valid JWT token', async () => {
    const protectedHandler = requireAuth((_req, _ctx, auth) =>
      NextResponse.json({ userId: auth.userId })
    );

    await fc.assert(
      fc.asyncProperty(fc.uuid(), async (userId) => {
        const token = await generateJWT(userId);
        const response = (await protectedHandler(createRequest(token), {})) as NextResponse;
        expect(response.status).toBe(200);
        const payload = await response.json();
        expect(payload.userId).toBe(userId);
      })
    );
  });
});
