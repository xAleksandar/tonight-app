import { describe, it, expect, vi, beforeAll, afterEach } from 'vitest';
import fc from 'fast-check';
import { NextRequest } from 'next/server';
import { getAuthCookieName, hashToken } from '@/lib/auth';

interface MagicLinkRecord {
  id: string;
  token: string;
  email: string;
  expiresAt: Date;
  usedAt: Date | null;
  createdAt: Date;
  userId: string | null;
}

interface UserRecord {
  id: string;
  email: string;
  displayName: string | null;
  photoUrl: string | null;
  createdAt: Date;
  updatedAt: Date;
}

type FindMagicLink = (args: { where: { token: string } }) => Promise<MagicLinkRecord | null>;
type UpdateMagicLink = (args: {
  where: { id: string };
  data: { usedAt?: Date; userId?: string | null };
}) => Promise<MagicLinkRecord>;
type UpsertUser = (args: {
  where: { email: string };
  update: Record<string, never>;
  create: { email: string };
}) => Promise<UserRecord>;

interface MockPrisma {
  magicLink: {
    findUnique: ReturnType<typeof vi.fn<FindMagicLink>>;
    update: ReturnType<typeof vi.fn<UpdateMagicLink>>;
    deleteMany: ReturnType<typeof vi.fn>;
    create: ReturnType<typeof vi.fn>;
  };
  user: {
    upsert: ReturnType<typeof vi.fn<UpsertUser>>;
    findUnique: ReturnType<typeof vi.fn>;
  };
}

function createMockPrisma(): MockPrisma {
  return {
    magicLink: {
      findUnique: vi.fn<FindMagicLink>(),
      update: vi.fn<UpdateMagicLink>(),
      deleteMany: vi.fn(),
      create: vi.fn(),
    },
    user: {
      upsert: vi.fn<UpsertUser>(),
      findUnique: vi.fn(),
    },
  };
}

type GlobalWithPrisma = typeof globalThis & { __TEST_PRISMA__?: MockPrisma };

vi.mock('@/lib/prisma', () => {
  const prisma = createMockPrisma();
  (globalThis as GlobalWithPrisma).__TEST_PRISMA__ = prisma;
  return { prisma };
});

const getMockPrisma = (): MockPrisma => {
  const mock = (globalThis as GlobalWithPrisma).__TEST_PRISMA__;
  if (!mock) {
    throw new Error('Mock Prisma has not been initialized');
  }
  return mock;
};

import { GET as verifyMagicLink } from '@/app/api/auth/verify/route';
import { POST as logout } from '@/app/api/auth/logout/route';

const hexChars = '0123456789abcdef'.split('');
const fixedLengthHex = (length: number) =>
  fc
    .array(fc.constantFrom(...hexChars), { minLength: length, maxLength: length })
    .map((chars) => chars.join(''));
const rangedHex = (min: number, max: number) =>
  fc
    .array(fc.constantFrom(...hexChars), { minLength: min, maxLength: max })
    .map((chars) => chars.join(''));

const hexTokenArb = fixedLengthHex(64);
const emailArb = fc.emailAddress();
const secondsArb = fc.integer({ min: 1, max: 60 * 60 });
const userIdArb = fc.uuid();
const cookieValueArb = fc.option(rangedHex(1, 256), {
  nil: undefined,
});

const buildVerifyRequest = (token: string) =>
  new NextRequest(`https://example.com/api/auth/verify?token=${token}`);

const buildLogoutRequest = (cookieValue?: string) =>
  new NextRequest('https://example.com/api/auth/logout', {
    method: 'POST',
    headers:
      cookieValue !== undefined
        ? {
            cookie: `${getAuthCookieName()}=${cookieValue}`,
          }
        : undefined,
  });

beforeAll(() => {
  process.env.NEXTAUTH_SECRET = process.env.NEXTAUTH_SECRET ?? 'test-secret';
});

afterEach(() => {
  const prisma = (globalThis as GlobalWithPrisma).__TEST_PRISMA__;
  if (!prisma) {
    return;
  }
  Object.values(prisma.magicLink).forEach((fn) => fn.mockReset());
  Object.values(prisma.user).forEach((fn) => fn.mockReset());
});

describe('Property 3: Expired Token Rejection', () => {
  it('rejects verification attempts when the stored magic link is expired', async () => {
    await fc.assert(
      fc.asyncProperty(hexTokenArb, emailArb, secondsArb, async (token, email, secondsAgo) => {
        const prisma = getMockPrisma();
        const hashed = hashToken(token);
        const expiredAt = new Date(Date.now() - (secondsAgo + 1) * 1000);
        prisma.magicLink.findUnique.mockImplementation(async (args) => {
          expect(args.where.token).toBe(hashed);
          return {
            id: `ml-${email}`,
            token: hashed,
            email,
            expiresAt: expiredAt,
            usedAt: null,
            createdAt: new Date(expiredAt.getTime() - 60 * 1000),
            userId: null,
          };
        });

        const updateCalls = prisma.magicLink.update.mock.calls.length;
        const response = await verifyMagicLink(buildVerifyRequest(token));
        expect(response.status).toBe(400);
        const payload = await response.json();
        expect(String(payload.error).toLowerCase()).toContain('expired');
        expect(prisma.magicLink.update.mock.calls.length).toBe(updateCalls);
        expect(prisma.user.upsert).not.toHaveBeenCalled();
      })
    );
  });
});

describe('Property 4: Single-Use Token Enforcement', () => {
  it('issues a session cookie once and rejects subsequent reuse attempts', async () => {
    await fc.assert(
      fc.asyncProperty(hexTokenArb, emailArb, userIdArb, async (token, email, userId) => {
        const prisma = getMockPrisma();
        const hashed = hashToken(token);
        const magicLinkBase: MagicLinkRecord = {
          id: `ml-${userId}`,
          token: hashed,
          email,
          expiresAt: new Date(Date.now() + 15 * 60 * 1000),
          usedAt: null,
          createdAt: new Date(),
          userId: null,
        };
        let storedLink: MagicLinkRecord = { ...magicLinkBase };

        prisma.magicLink.findUnique.mockImplementation(async (args) => {
          expect(args.where.token).toBe(hashed);
          return storedLink;
        });

        prisma.user.upsert.mockImplementation(async ({ where }) => {
          expect(where.email).toBe(email);
          return {
            id: userId,
            email,
            displayName: null,
            photoUrl: null,
            createdAt: new Date(),
            updatedAt: new Date(),
          };
        });

        prisma.magicLink.update.mockImplementation(async ({ where, data }) => {
          expect(where.id).toBe(magicLinkBase.id);
          storedLink = {
            ...storedLink,
            usedAt: data.usedAt ?? storedLink.usedAt,
            userId: data.userId ?? storedLink.userId,
          };
          return storedLink;
        });

        const upsertCallsBefore = prisma.user.upsert.mock.calls.length;
        const updateCallsBefore = prisma.magicLink.update.mock.calls.length;

        const request = buildVerifyRequest(token);
        const response = await verifyMagicLink(request);
        expect(response.status).toBeGreaterThanOrEqual(300);
        expect(response.status).toBeLessThan(400);
        const cookie = response.cookies.get(getAuthCookieName());
        expect(cookie?.value).toBeTruthy();

        const updateCall = prisma.magicLink.update.mock.calls.at(-1);
        expect(updateCall?.[0]?.data?.usedAt).toBeInstanceOf(Date);
        expect(updateCall?.[0]?.data?.userId).toBe(userId);

        expect(prisma.user.upsert.mock.calls.length).toBe(upsertCallsBefore + 1);
        expect(prisma.magicLink.update.mock.calls.length).toBe(updateCallsBefore + 1);

        const upsertCallsAfterFirst = prisma.user.upsert.mock.calls.length;
        const updateCallsAfterFirst = prisma.magicLink.update.mock.calls.length;

        const secondResponse = await verifyMagicLink(buildVerifyRequest(token));
        expect(secondResponse.status).toBe(400);
        const errorPayload = await secondResponse.json();
        expect(String(errorPayload.error).toLowerCase()).toContain('used');
        expect(prisma.user.upsert.mock.calls.length).toBe(upsertCallsAfterFirst);
        expect(prisma.magicLink.update.mock.calls.length).toBe(updateCallsAfterFirst);
      })
    );
  });
});

describe('Property 5: Logout Cookie Clearing', () => {
  it('clears the auth cookie for any previously issued session token', async () => {
    await fc.assert(
      fc.asyncProperty(cookieValueArb, async (cookieValue) => {
        const response = await logout(buildLogoutRequest(cookieValue ?? undefined));
        expect(response.status).toBe(200);
        const clearedCookie = response.cookies.get(getAuthCookieName());
        expect(clearedCookie?.value).toBe('');
        expect(clearedCookie?.maxAge).toBe(0);
        expect(clearedCookie?.expires).toBeInstanceOf(Date);
        expect(clearedCookie?.expires!.getTime()).toBeLessThan(Date.now());
      })
    );
  });
});
