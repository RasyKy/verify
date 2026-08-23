/**
 * smtpAdapter tests.
 *
 * The adapter exists so an SMTP send reports failure the same way a Resend
 * send does — through a resolved `{ error }` rather than a thrown exception.
 * Every case here is one that would otherwise be reported as a successful
 * send: nodemailer throws where Resend resolves, and it resolves for a
 * per-recipient refusal that is not a delivery at all.
 */
import { jest } from '@jest/globals';

import { smtpAdapter } from '../src/services/email.js';

const MESSAGE = {
  from: 'Verify <sender@gmail.com>',
  to: 'sophat@example.com',
  subject: 'Your certificate',
  html: '<p>hi</p>',
};

describe('smtpAdapter()', () => {
  it('passes the message through to nodemailer unchanged', async () => {
    const sendMail = jest.fn(async () => ({ messageId: '<abc@gmail.com>' }));
    await smtpAdapter({ sendMail }).emails.send(MESSAGE);

    expect(sendMail).toHaveBeenCalledWith(MESSAGE);
  });

  it('reports a delivered message as Resend does, with no error', async () => {
    const sendMail = jest.fn(async () => ({
      messageId: '<abc@gmail.com>',
      rejected: [],
    }));

    const result = await smtpAdapter({ sendMail }).emails.send(MESSAGE);

    expect(result.error).toBeNull();
    expect(result.data).toEqual({ id: '<abc@gmail.com>' });
  });

  it('treats a rejected recipient as an error, not a successful send', async () => {
    // sendMail RESOLVES here — the server accepted the session and refused the
    // address. Reading only the resolution would call this delivered.
    const sendMail = jest.fn(async () => ({
      messageId: '<abc@gmail.com>',
      rejected: ['sophat@example.com'],
      responseCode: 550,
    }));

    const result = await smtpAdapter({ sendMail }).emails.send(MESSAGE);

    expect(result.data).toBeNull();
    expect(result.error).toMatchObject({ statusCode: 550 });
    expect(result.error.message).toContain('sophat@example.com');
  });

  it('translates a thrown auth failure into an error object', async () => {
    // 535 is what a wrong or non-app password looks like.
    const sendMail = jest.fn(async () => {
      const err = new Error(
        'Invalid login: 535-5.7.8 Username and Password not accepted'
      );
      err.code = 'EAUTH';
      err.responseCode = 535;
      throw err;
    });

    const result = await smtpAdapter({ sendMail }).emails.send(MESSAGE);

    expect(result).toEqual({
      data: null,
      error: {
        name: 'EAUTH',
        statusCode: 535,
        message: expect.stringContaining('535-5.7.8'),
      },
    });
  });

  it('never rejects, even for a connection error carrying no SMTP code', async () => {
    const sendMail = jest.fn(async () => {
      throw new Error('connect ECONNREFUSED');
    });

    await expect(
      smtpAdapter({ sendMail }).emails.send(MESSAGE)
    ).resolves.toMatchObject({
      data: null,
      error: { name: 'smtp_error', statusCode: 0 },
    });
  });
});
