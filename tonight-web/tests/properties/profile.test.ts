import { describe, it, expect, vi, afterEach } from 'vitest';
import fc from 'fast-check';
import { NextRequest } from 'next/server';
import { patchProfileHandler } from '@/app/api/users/me/route';

type MockPrisma = {
  user: {
    update: ReturnType<typeof vi.fn>;
  };
};

type GlobalWithPrisma = typeof globalThis & { __TEST_PRISMA__?: MockPrisma };

function createMockPrisma(): MockPrisma {
  return {
    user: {
      update: vi.fn(),
    },
  };
}

vi.mock('@/lib/prisma', () => {
  const prisma = createMockPrisma();
  (globalThis as GlobalWithPrisma).__TEST_PRISMA__ = prisma;
  return { prisma };
});

const getMockPrisma = (): MockPrisma => {
  const prisma = (globalThis as GlobalWithPrisma).__TEST_PRISMA__;
  if (!prisma) {
    throw new Error('Mock Prisma is not initialized');
  }
  return prisma;
};

const buildRequest = (body: Record<string, unknown>) =>
  new NextRequest('https://example.com/api/users/me', {
    method: 'PATCH',
    body: JSON.stringify(body),
    headers: { 'Content-Type': 'application/json' },
  });

const displayNameArb = fc
  .string({ minLength: 2, maxLength: 48 })
  .filter((value) => value.trim().length >= 2);

const photoUrlArb = fc.webUrl({
  authoritySettings: { withIPv4: false, withIPv6: false, withUserInfo: false },
  validSchemes: ['http', 'https'],
});

const creationDateArb = fc
  .date({
    min: new Date('2000-01-01T00:00:00.000Z'),
    max: new Date('2100-01-01T00:00:00.000Z'),
  })
  .filter((date) => Number.isFinite(date.getTime()));

afterEach(() => {
  const prisma = getMockPrisma();
  prisma.user.update.mockReset();
});

const serializeDate = (date: Date) => new Date(date.getTime());

describe('Property 10: Profile Update Round Trip', () => {
  it('persists sanitized profile values and returns the updated payload', async () => {
    await fc.assert(
      fc.asyncProperty(fc.uuid(), displayNameArb, photoUrlArb, fc.emailAddress(), async (userId, name, photoUrl, email) => {
        const prisma = getMockPrisma();
        const createdAt = serializeDate(new Date());
        const trimmedName = name.trim();
        const trimmedPhoto = photoUrl.trim();

        prisma.user.update.mockResolvedValue({
          id: userId,
          email,
          displayName: trimmedName,
          photoUrl: trimmedPhoto,
          createdAt,
          updatedAt: createdAt,
        });

        const request = buildRequest({
          displayName: `  ${name}  `,
          photoUrl: `\n${photoUrl}\n`,
        });

        const response = await patchProfileHandler(request, {}, { userId, token: 'token' });
        expect(response.status).toBe(200);

        const payload = await response.json();
        expect(payload.user).toEqual({
          id: userId,
          email,
          displayName: trimmedName,
          photoUrl: trimmedPhoto,
          createdAt: createdAt.toISOString(),
        });

        const updateArgs = prisma.user.update.mock.calls.at(-1)?.[0];
        expect(updateArgs).toMatchObject({
          where: { id: userId },
          data: { displayName: trimmedName, photoUrl: trimmedPhoto },
        });
      })
    );
  });
});

describe('Property 11: Profile Creation Timestamp', () => {
  it('preserves the creation timestamp from the database response', async () => {
    await fc.assert(
      fc.asyncProperty(fc.uuid(), creationDateArb, async (userId, createdAt) => {
        const prisma = getMockPrisma();
        const isoDate = serializeDate(createdAt);

        prisma.user.update.mockResolvedValue({
          id: userId,
          email: `${userId}@example.com`,
          displayName: null,
          photoUrl: null,
          createdAt: isoDate,
          updatedAt: isoDate,
        });

        const request = buildRequest({ displayName: 'Example User' });
        const response = await patchProfileHandler(request, {}, { userId, token: 'token' });
        expect(response.status).toBe(200);

        const payload = await response.json();
        expect(payload.user.createdAt).toBe(isoDate.toISOString());
      })
    );
  });
});
