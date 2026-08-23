/**
 * sendExpiryReminderEmail tests (FR-EXP-03).
 *
 * Unlike sendClaimEmail, this function accepts `client`/`emailEnabled`
 * overrides specifically so its gate and error-swallowing behaviour can be
 * exercised deterministically here, without a live Resend call.
 */
import { jest } from '@jest/globals';

import { sendExpiryReminderEmail } from '../src/services/email.js';

const ARGS = {
  to: 'sophat@example.com',
  studentName: 'Chea Sophat',
  courseName: 'Web Development Fundamentals',
  institutionName: 'Royal Phnom Penh University',
  expiryDate: '2026-10-20',
};

describe('sendExpiryReminderEmail()', () => {
  it('renders the template with all interpolated fields HTML-escaped', async () => {
    const send = jest.fn(async () => ({}));
    await sendExpiryReminderEmail({
      ...ARGS,
      studentName: '<script>alert(1)</script>',
      emailEnabled: true,
      client: { emails: { send } },
    });

    const html = send.mock.calls[0][0].html;
    expect(html).not.toContain('<script>alert(1)</script>');
    expect(html).toContain('&lt;script&gt;alert(1)&lt;/script&gt;');
  });

  it('includes the institution name in the subject line', async () => {
    const send = jest.fn(async () => ({}));
    await sendExpiryReminderEmail({
      ...ARGS,
      emailEnabled: true,
      client: { emails: { send } },
    });

    expect(send.mock.calls[0][0].subject).toContain(
      'Royal Phnom Penh University'
    );
  });

  it('respects the emailEnabled gate and never calls the client when disabled', async () => {
    const send = jest.fn(async () => ({}));
    const result = await sendExpiryReminderEmail({
      ...ARGS,
      emailEnabled: false,
      client: { emails: { send } },
    });

    expect(result).toEqual({ sent: false });
    expect(send).not.toHaveBeenCalled();
  });

  it('sends successfully when enabled, with the right to/from', async () => {
    const send = jest.fn(async () => ({}));
    const result = await sendExpiryReminderEmail({
      ...ARGS,
      emailEnabled: true,
      client: { emails: { send } },
    });

    expect(result).toEqual({ sent: true });
    expect(send.mock.calls[0][0]).toMatchObject({ to: ARGS.to });
    expect(send.mock.calls[0][0].from).toBeTruthy();
  });

  it('logs and swallows a send rejection rather than throwing', async () => {
    const send = jest.fn(async () => {
      throw new Error('resend down');
    });

    await expect(
      sendExpiryReminderEmail({
        ...ARGS,
        emailEnabled: true,
        client: { emails: { send } },
      })
    ).resolves.toEqual({ sent: false });
  });
});
