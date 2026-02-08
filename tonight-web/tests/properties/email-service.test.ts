import { describe, it, expect, vi } from 'vitest';
import fc from 'fast-check';
import { sendMagicLink } from '@/lib/email';

const hexTokenArb = fc
  .array(fc.integer({ min: 0, max: 15 }), { minLength: 64, maxLength: 64 })
  .map((values) => values.map((value) => value.toString(16)).join(''));
const baseUrl = 'https://tonight.test';

describe('Property 39: Magic Link Email Content', () => {
  it('includes verification URLs and expiration guidance for every request', async () => {
    await fc.assert(
      fc.asyncProperty(fc.emailAddress(), hexTokenArb, async (email, token) => {
        const sendSpy = vi.fn().mockResolvedValue(undefined);
        const resendClient = { emails: { send: sendSpy } };

        await sendMagicLink(email, token, { resendClient, baseUrl });

        expect(sendSpy).toHaveBeenCalledTimes(1);
        const payload = sendSpy.mock.calls[0][0];
        const verificationUrl = `${baseUrl}/api/auth/verify?token=${encodeURIComponent(token)}`;

        expect(payload.to).toBe(email);
        expect(payload.subject.toLowerCase()).toContain('login');
        expect(payload.text).toContain(verificationUrl);
        expect(payload.html).toContain(verificationUrl);
        expect(payload.text.toLowerCase()).toContain('expires');
        expect(payload.html.toLowerCase()).toContain('expires');
      })
    );
  });
});

describe('Property 40: Email Delivery Error Handling', () => {
  it('surfaces delivery failures from the email provider', async () => {
    await fc.assert(
      fc.asyncProperty(fc.emailAddress(), hexTokenArb, async (email, token) => {
        const resendClient = {
          emails: {
            send: vi.fn().mockRejectedValue(new Error('network error')),
          },
        };

        await expect(
          sendMagicLink(email, token, { resendClient, baseUrl })
        ).rejects.toThrow(/Failed to send magic link email/);
      })
    );
  });
});
