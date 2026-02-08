import { Resend } from 'resend';
import { computeMagicLinkExpiration } from '@/lib/auth';

export interface MagicLinkEmailOptions {
  resendClient?: ResendLike;
  logger?: Pick<typeof console, 'info'>;
  baseUrl?: string;
}

export interface ResendLike {
  emails: {
    send: (payload: MagicLinkEmailPayload) => Promise<unknown>;
  };
}

export interface MagicLinkEmailPayload {
  from: string;
  to: string;
  subject: string;
  text: string;
  html: string;
}

const DEFAULT_FROM = 'Tonight <onboarding@resend.dev>';
const MAGIC_LINK_SUBJECT = 'Your Tonight login link';
let cachedClient: ResendLike | null | undefined;

const sanitizeBaseUrl = (url: string): string => {
  if (url.endsWith('/')) {
    return url.slice(0, -1);
  }
  return url;
};

const getBaseUrl = (override?: string): string => {
  const fromEnv = process.env.NEXT_PUBLIC_APP_URL ?? 'http://localhost:3000';
  return sanitizeBaseUrl(override ?? fromEnv);
};

const getResendClient = (): ResendLike | null => {
  if (cachedClient !== undefined) {
    return cachedClient;
  }

  const apiKey = process.env.RESEND_API_KEY;
  if (!apiKey) {
    cachedClient = null;
    return null;
  }

  cachedClient = new Resend(apiKey);
  return cachedClient;
};

const buildVerificationUrl = (token: string, baseUrl: string): string => {
  const encodedToken = encodeURIComponent(token);
  return `${baseUrl}/api/auth/verify?token=${encodedToken}`;
};

const buildEmailBody = (verificationUrl: string, expiresAt: Date) => {
  const text = [
    'Hi there!',
    '',
    'Use the secure link below to finish signing in to Tonight.',
    verificationUrl,
    '',
    `This link expires at ${expiresAt.toISOString()} (15 minutes from now).`,
    'If you did not request this link you can safely ignore this email.',
  ].join('\n');

  const html = `
    <p>Hi there!</p>
    <p>Use the secure link below to finish signing in to Tonight.</p>
    <p><a href="${verificationUrl}">Complete sign in</a></p>
    <p>This link expires at <strong>${expiresAt.toISOString()}</strong> (15 minutes from now).</p>
    <p>If you did not request this link you can safely ignore this email.</p>
  `;

  return { text, html };
};

export const sendMagicLink = async (
  email: string,
  token: string,
  options?: MagicLinkEmailOptions
): Promise<void> => {
  if (!email) {
    throw new Error('email is required');
  }

  if (!token) {
    throw new Error('token is required');
  }

  const baseUrl = getBaseUrl(options?.baseUrl);
  const verificationUrl = buildVerificationUrl(token, baseUrl);
  const expiresAt = computeMagicLinkExpiration();
  const body = buildEmailBody(verificationUrl, expiresAt);

  const payload: MagicLinkEmailPayload = {
    from: DEFAULT_FROM,
    to: email,
    subject: MAGIC_LINK_SUBJECT,
    text: body.text,
    html: body.html,
  };

  const client = options?.resendClient ?? getResendClient();
  if (!client) {
    (options?.logger ?? console).info(`[Magic Link] ${email}: ${verificationUrl}`);
    return;
  }

  try {
    await client.emails.send(payload);
  } catch (error) {
    throw new Error(`Failed to send magic link email: ${(error as Error).message}`);
  }
};
