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
import { getSmtpConfig } from '@/constants/smtp.constants';

export interface OutgoingMail {
  to: string;
  subject: string;
  text?: string;
  html?: string;
}

export const sendMail = async ({
  to,
  subject,
  text,
  html,
}: OutgoingMail): Promise<void> => {
  // Resolved per call rather than at module scope: this module is in the
  // Worker's static graph (queue consumer -> smtp.config), and Cloudflare
  // evaluates that graph at upload time, before any env is available.
  const config = getSmtpConfig();

  const from = config.fromName
    ? { name: config.fromName, email: config.from }
    : config.from;

  const mailer = await WorkerMailer.connect({
    host: config.host,
    port: config.port,
    secure: config.secure,
    startTls: !config.secure,
    credentials: { username: config.user, password: config.pass },
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
