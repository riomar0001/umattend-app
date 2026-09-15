import type { CookieOptions } from 'express';
import getEnv from '@/utils/envHandler';
import {
  JWT_ACCESS_TOKEN_TTL,
  JWT_REFRESH_TOKEN_TTL,
} from '@/constants/jwt.constants';
import { NODE_ENV } from '@/constants/app.constants';

/**
 * Options for the `access_token` / `refresh_token` cookies.
 *
 * These exist so a session survives a page reload: the auth store deliberately
 * keeps tokens in memory only (see `partialize` in client/src/store/authStore.ts
 * — "tokens stay in memory only to reduce XSS exposure"), so the cookies are
 * the only thing that persists.
 *
 * That worked when one origin served both the app and the API. It no longer
 * does by default: the API is on api*.umattend.site and the frontend on
 * staging.umattend.site, so a host-only cookie set by the OAuth callback is
 * scoped to the API host and never accompanies requests the browser makes to
 * the frontend — including the ones the Next.js proxy forwards.
 *
 * `COOKIE_DOMAIN` fixes that by widening the cookie to the registrable domain
 * (".umattend.site"), which both hosts share. Leave it unset locally, where
 * everything is on localhost and a host-only cookie is correct.
 *
 * SameSite is `lax` rather than `strict` because the browser arrives at the
 * frontend via a cross-site redirect from Google; `strict` would withhold the
 * cookie on exactly that navigation.
 */
const cookieDomain = () => getEnv('COOKIE_DOMAIN', false) || undefined;

const base = (): CookieOptions => ({
  httpOnly: true,
  secure: NODE_ENV !== 'DEVELOPMENT',
  sameSite: 'lax',
  domain: cookieDomain(),
  path: '/',
});

export const accessTokenCookie = (): CookieOptions => ({
  ...base(),
  maxAge: Number(JWT_ACCESS_TOKEN_TTL) * 60 * 60 * 1000,
});

export const refreshTokenCookie = (): CookieOptions => ({
  ...base(),
  maxAge: Number(JWT_REFRESH_TOKEN_TTL) * 60 * 60 * 1000,
});

/**
 * `clearCookie` only removes a cookie when domain and path match those it was
 * set with — otherwise the browser sees a different cookie and the old one
 * survives, leaving the user logged in after logout.
 */
export const clearCookieOptions = (): CookieOptions => ({
  httpOnly: true,
  secure: NODE_ENV !== 'DEVELOPMENT',
  sameSite: 'lax',
  domain: cookieDomain(),
  path: '/',
});
