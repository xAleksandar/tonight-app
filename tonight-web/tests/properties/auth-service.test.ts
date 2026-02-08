import { describe, it, beforeAll, expect } from 'vitest';
import fc from 'fast-check';
import { SignJWT, jwtVerify } from 'jose';
import {
  computeMagicLinkExpiration,
  generateJWT,
  generateMagicLinkToken,
  verifyJWT,
} from '@/lib/auth';

const textEncoder = new TextEncoder();

const getSecret = () => textEncoder.encode(process.env.NEXTAUTH_SECRET ?? 'test-secret');

beforeAll(() => {
  process.env.NEXTAUTH_SECRET = process.env.NEXTAUTH_SECRET ?? 'test-secret';
});

describe('Property 1: Magic Link Token Generation and Expiration', () => {
  it('generates unique 32-byte hex tokens with 15-minute expiration windows', () => {
    const minTimestamp = Date.parse('2000-01-01T00:00:00.000Z');
    const maxTimestamp = Date.parse('2100-01-01T00:00:00.000Z') - 15 * 60 * 1000;

    fc.assert(
      fc.property(
        fc.integer({ min: minTimestamp, max: maxTimestamp }),
        (timestamp) => {
          const createdAt = new Date(timestamp);
          const tokenA = generateMagicLinkToken();
          const tokenB = generateMagicLinkToken();
          expect(tokenA).toMatch(/^[0-9a-f]{64}$/);
          expect(tokenB).toMatch(/^[0-9a-f]{64}$/);
          expect(tokenA).not.toEqual(tokenB);

          const expiration = computeMagicLinkExpiration(createdAt);
          expect(expiration.getTime() - createdAt.getTime()).toBe(15 * 60 * 1000);
        }
      )
    );
  });
});

describe('Property 2: Magic Link Authentication Round Trip', () => {
  it('issues JWTs with seven-day lifetimes for authenticated users', async () => {
    await fc.assert(
      fc.asyncProperty(fc.uuid(), async (userId) => {
        const token = await generateJWT(userId);
        const { payload } = await jwtVerify(token, getSecret());
        expect(payload.userId).toBe(userId);
        expect(typeof payload.iat).toBe('number');
        expect(typeof payload.exp).toBe('number');
        const durationSeconds = (payload.exp ?? 0) - (payload.iat ?? 0);
        expect(durationSeconds).toBe(60 * 60 * 24 * 7);
      })
    );
  });
});

describe('Property 6: JWT Authentication Round Trip', () => {
  it('verifies JWT payloads and returns the correct user identity', async () => {
    await fc.assert(
      fc.asyncProperty(fc.uuid(), async (userId) => {
        const token = await generateJWT(userId);
        const payload = await verifyJWT(token);
        expect(payload.userId).toBe(userId);
      })
    );
  });
});

describe('Property 7: JWT Expiration Enforcement', () => {
  it('rejects tokens where the expiration time has elapsed', async () => {
    await fc.assert(
      fc.asyncProperty(fc.uuid(), async (userId) => {
        const expiredToken = await new SignJWT({ userId })
          .setProtectedHeader({ alg: 'HS256' })
          .setIssuedAt(Math.floor(Date.now() / 1000) - 60 * 60 * 24 * 8)
          .setExpirationTime(Math.floor(Date.now() / 1000) - 60)
          .sign(getSecret());

        await expect(verifyJWT(expiredToken)).rejects.toThrow();
      })
    );
  });
});
