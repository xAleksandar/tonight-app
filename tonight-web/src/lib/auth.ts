import { createHash, randomBytes } from 'node:crypto';
import { SignJWT, jwtVerify } from 'jose';

const MAGIC_LINK_TOKEN_BYTES = 32;
export const MAGIC_LINK_EXPIRATION_MINUTES = 15;
const JWT_EXPIRATION_DAYS = 7;
const AUTH_COOKIE_NAME = 'tonight_auth';

const textEncoder = new TextEncoder();

const getJwtSecret = (): Uint8Array => {
  const secret = process.env.NEXTAUTH_SECRET;
  if (!secret) {
    throw new Error('NEXTAUTH_SECRET environment variable is not set');
  }
  return textEncoder.encode(secret);
};

export const getAuthCookieName = (): string => AUTH_COOKIE_NAME;

export const generateMagicLinkToken = (): string => {
  return randomBytes(MAGIC_LINK_TOKEN_BYTES).toString('hex');
};

export const computeMagicLinkExpiration = (createdAt: Date = new Date()): Date => {
  return new Date(createdAt.getTime() + MAGIC_LINK_EXPIRATION_MINUTES * 60 * 1000);
};

export const hashToken = (token: string): string => {
  if (!token) {
    throw new Error('token is required');
  }
  return createHash('sha256').update(token).digest('hex');
};

export const generateJWT = async (userId: string): Promise<string> => {
  if (!userId) {
    throw new Error('userId is required');
  }

  return await new SignJWT({ userId })
    .setProtectedHeader({ alg: 'HS256' })
    .setIssuedAt()
    .setExpirationTime(`${JWT_EXPIRATION_DAYS}d`)
    .sign(getJwtSecret());
};

export const verifyJWT = async (token: string): Promise<{ userId: string }> => {
  if (!token) {
    throw new Error('token is required');
  }

  const { payload } = await jwtVerify(token, getJwtSecret());
  const userId = payload.userId;

  if (typeof userId !== 'string' || !userId) {
    throw new Error('Invalid token payload');
  }

  return { userId };
};
