/**
 * sendIssuerInviteEmail tests.
 *
 * `POST /admin/users` creates an account with a throwaway random password that
 * is never shown to anyone, so this email is the ONLY thing that tells a new
 * issuer their account exists. Two properties matter enough to pin down:
 *
 *   • the link must reach the code-based reset page with the address prefilled,
 *     because that is the invitee's entire path in; and
 *   • a send failure must never throw — the route deletes a half-created auth
 *     user in its catch block, and a mail hiccup must not take a perfectly good
 *     issuer account down with it.
 *
 * Mirrors email.expiryReminder.test.js, using the same client/emailEnabled
 * overrides rather than a live provider call.
 */
import { jest } from '@jest/globals';

import {
  buildIssuerInviteUrl,
  sendIssuerInviteEmail,
} from '../src/services/email.js';

const ARGS = {
  to: 'dara@rupp.edu.kh',
  fullName: 'Sok Dara',
  organizationName: 'Royal University of Phnom Penh',
};

describe('buildIssuerInviteUrl()', () => {
  it('points at the code-based reset page with the address prefilled', () => {
    // setupEnv.js pins FRONTEND_URL to the localhost dev origin.
    expect(buildIssuerInviteUrl('dara@rupp.edu.kh')).toBe(
      'http://localhost:3000/auth/forgot-password?email=dara%40rupp.edu.kh'
    );
  });

  it('encodes an address containing characters that are legal in a mailbox but not in a query string', () => {
    expect(buildIssuerInviteUrl('a+b&c@example.com')).toContain(
      'email=a%2Bb%26c%40example.com'
    );
  });
});

describe('sendIssuerInviteEmail()', () => {
  it('carries the invite link in the body', async () => {
    const send = jest.fn(async () => ({}));
    await sendIssuerInviteEmail({
      ...ARGS,
      emailEnabled: true,
      client: { emails: { send } },
    });

    expect(send.mock.calls[0][0].html).toContain(buildIssuerInviteUrl(ARGS.to));
  });

  it('escapes interpolated names rather than rendering them as markup', async () => {
    const send = jest.fn(async () => ({}));
    await sendIssuerInviteEmail({
      ...ARGS,
      fullName: '<script>alert(1)</script>',
      emailEnabled: true,
      client: { emails: { send } },
    });

    const html = send.mock.calls[0][0].html;
    expect(html).not.toContain('<script>alert(1)</script>');
    expect(html).toContain('&lt;script&gt;alert(1)&lt;/script&gt;');
  });

  it('names the institution in the subject line', async () => {
    const send = jest.fn(async () => ({}));
    await sendIssuerInviteEmail({
      ...ARGS,
      emailEnabled: true,
      client: { emails: { send } },
    });

    expect(send.mock.calls[0][0].subject).toContain(
      'Royal University of Phnom Penh'
    );
  });

  it('sends to the invitee, from the configured sender', async () => {
    const send = jest.fn(async () => ({}));
    const result = await sendIssuerInviteEmail({
      ...ARGS,
      emailEnabled: true,
      client: { emails: { send } },
    });

    expect(result).toEqual({ sent: true });
    expect(send.mock.calls[0][0]).toMatchObject({ to: ARGS.to });
    expect(send.mock.calls[0][0].from).toBeTruthy();
  });

  it('respects the emailEnabled gate and never calls the client when disabled', async () => {
    const send = jest.fn(async () => ({}));
    const result = await sendIssuerInviteEmail({
      ...ARGS,
      emailEnabled: false,
      client: { emails: { send } },
    });

    expect(result).toEqual({ sent: false });
    expect(send).not.toHaveBeenCalled();
  });

  it('reports sent:false when the provider refuses the message', async () => {
    const send = jest.fn(async () => ({
      data: null,
      error: {
        name: 'validation_error',
        statusCode: 403,
        message: 'You can only send testing emails to your own email address.',
      },
    }));

    await expect(
      sendIssuerInviteEmail({
        ...ARGS,
        emailEnabled: true,
        client: { emails: { send } },
      })
    ).resolves.toEqual({ sent: false });
  });

  it('swallows a send rejection rather than throwing at the route', async () => {
    const send = jest.fn(async () => {
      throw new Error('smtp down');
    });

    await expect(
      sendIssuerInviteEmail({
        ...ARGS,
        emailEnabled: true,
        client: { emails: { send } },
      })
    ).resolves.toEqual({ sent: false });
  });
});
