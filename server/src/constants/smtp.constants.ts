import getEnv from '@/utils/envHandler';

const MAIL_HOST = getEnv('MAIL_HOST');
const MAIL_PORT = parseInt(getEnv('MAIL_PORT', false));
const MAIL_SECURE = getEnv('MAIL_SECURE', false);

// SMTP account used to authenticate. With Gmail this is the mailbox that owns
// the App Password, which is not necessarily the address mail appears to come
// from.
const MAIL_USER = getEnv('MAIL_USER');
const MAIL_PASS = getEnv('MAIL_PASS');

// Envelope/header From. Defaults to MAIL_USER so existing setups where the two
// are the same keep working. When they differ, the provider must be willing to
// send on this address's behalf — for Gmail that means adding it under
// "Send mail as" and verifying it, otherwise Gmail silently rewrites the header
// back to MAIL_USER.
const MAIL_FROM = getEnv('MAIL_FROM', false) || MAIL_USER;
const MAIL_FROM_NAME = getEnv('MAIL_FROM_NAME', false);

export {
  MAIL_HOST,
  MAIL_PORT,
  MAIL_SECURE,
  MAIL_USER,
  MAIL_PASS,
  MAIL_FROM,
  MAIL_FROM_NAME,
};
