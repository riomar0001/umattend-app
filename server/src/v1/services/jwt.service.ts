import jwt from 'jsonwebtoken';
import prisma from '../../configs/prisma.config';
import { hashRefreshToken } from '../../utils/tokenHashing';
import { v4 as uuidv4 } from 'uuid';
import { AccessTokenPayloadTypes } from '../types/token';
import { GenerateTokenError } from '../../utils/customErrors';
import { UAParser } from 'ua-parser-js';
import {
  JWT_ACCESS_TOKEN_SECRET,
  JWT_ACCESS_TOKEN_TTL,
  JWT_REFRESH_TOKEN_SECRET,
  JWT_REFRESH_TOKEN_TTL,
} from '../../constants/jwt.constants';
import type { RequestLocation } from '../../utils/geoHeaders';

export const generateAccessToken = (
  tokenPayload: AccessTokenPayloadTypes
): string => {
  const { user_id, umindanao_email, role, name } = tokenPayload;

  // The list is deliberately short. student_id is null until onboarding
  // supplies one, department and program are empty until it does, and
  // done_onboarding is false for every account on its first token — requiring
  // those would reject exactly the logins that have to succeed.
  //
  // The previous version wrapped all eight in an object and tested `!field` on
  // the object, which is never true, so nothing was ever checked. That is what
  // let a user with no student row mint a token carrying no name at all: the
  // account then read as "User" everywhere it was displayed.
  const requiredFields = { user_id, umindanao_email, role, name };

  const missing = Object.entries(requiredFields)
    .filter(([, value]) => !value)
    .map(([field]) => field);

  if (missing.length > 0) {
    throw new GenerateTokenError(
      `Missing required token payload fields: ${missing.join(', ')}`
    );
  }

  return jwt.sign(tokenPayload, JWT_ACCESS_TOKEN_SECRET, {
    expiresIn: `${JWT_ACCESS_TOKEN_TTL}h`,
  } as jwt.SignOptions);
};

export const generateRefreshToken = async (
  user_id: string,
  ip: string,
  user_agent: string,
  /**
   * Resolved by the caller from request headers — Cloudflare's or the frontend
   * proxy's, whichever describes the real visitor. Passed in rather than looked
   * up here because this function has no request to read, and because the
   * lookup it used to do (ip-api.com) was a blocking external call on the login
   * path. See utils/geoHeaders.
   */
  location: RequestLocation
) => {
  const token_id = uuidv4();

  const expires_at = new Date(
    Date.now() + Number(JWT_REFRESH_TOKEN_TTL) * 60 * 60 * 1000
  );

  const token = jwt.sign({ token_id, user_id }, JWT_REFRESH_TOKEN_SECRET, {
    expiresIn: `${JWT_REFRESH_TOKEN_TTL}h`,
  } as jwt.SignOptions);

  const hashedToken = await hashRefreshToken(token);

  const parser = new UAParser(user_agent);
  const result = parser.getResult();

  // UAParser only fills `device` for phones and tablets — a desktop browser
  // legitimately has neither a model nor a type. Reporting that as "Unknown"
  // made every laptop login look like a parse failure; it is simply a desktop.
  // Genuinely unparseable input (no UA header at all) still reads "Unknown".
  const device =
    result.device.model ??
    result.device.type ??
    (result.os.name ? 'Desktop' : 'Unknown');

  const os = result.os.name ?? 'Unknown';

  // `browser.name` falls back to the rendering engine when the UA carries no
  // product token — a UA ending at "AppleWebKit/537.36 (KHTML, like Gecko)"
  // reports "WebKit". That is a truncated User-Agent reaching us, not a real
  // browser; label it so the history does not imply a browser nobody uses.
  const engineOnly =
    result.browser.name !== undefined &&
    result.browser.name === result.engine.name;

  const browser = engineOnly
    ? `Unknown (${result.browser.name})`
    : (result.browser.name ?? 'Unknown');

  const { city, region, country } = location;

  await prisma.refresh_token.create({
    data: {
      id: token_id,
      user_id,
      token_hash: hashedToken,
      ip_address: ip,
      device,
      os,
      browser,
      city,
      region,
      country,
      expires_at,
      last_used: new Date(),
    },
  });

  return token;
};
