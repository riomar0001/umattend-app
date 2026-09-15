/**
 * SMTP transport for Workers.
 *
 * nodemailer cannot run here — it reaches for `net`/`tls` sockets that workerd
 * does not provide. `worker-mailer` speaks SMTP over Cloudflare's `connect()`
 * API instead.
 *
 * Cloudflare blocks outbound port 25, so use a submission port:
 *
 *   MAIL_PORT=587, MAIL_SECURE=false  -> plaintext connect, upgraded by STARTTLS
 *   MAIL_PORT=465, MAIL_SECURE=true   -> TLS from the first byte
 *
 * Submission ports always require TLS, so STARTTLS is requested whenever the
 * connection did not start out encrypted. Without it Gmail rejects the login
 * with "530 Must issue a STARTTLS command first".
 *
 * Sending happens only from the queue consumer, never on the request path.
 */

import { WorkerMailer } from 'worker-mailer';
import {
  MAIL_USER,
  MAIL_PASS,
  MAIL_HOST,
  MAIL_PORT,
  MAIL_SECURE,
  MAIL_FROM,
  MAIL_FROM_NAME,
} from '@/constants/smtp.constants';

export interface OutgoingMail {
  to: string;
  subject: string;
  text?: string;
  html?: string;
}

const secure = MAIL_SECURE === 'true';

const from = MAIL_FROM_NAME
  ? { name: MAIL_FROM_NAME, email: MAIL_FROM }
  : MAIL_FROM;

export const sendMail = async ({
  to,
  subject,
  text,
  html,
}: OutgoingMail): Promise<void> => {
  const mailer = await WorkerMailer.connect({
    host: MAIL_HOST,
    port: Number(MAIL_PORT),
    secure,
    startTls: !secure,
    credentials: { username: MAIL_USER, password: MAIL_PASS },
    // Gmail advertises both; 'login' is the one it actually prefers.
    authType: ['plain', 'login'],
  });

  try {
    await mailer.send({ from, to, subject, text, html });
  } finally {
    // Connections are per-send; a Worker has no process to keep a pool alive.
    await mailer.close();
  }
};

export default sendMail;
