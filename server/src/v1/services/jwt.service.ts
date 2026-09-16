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
import { getLocationByIp } from '../../utils/getIPLocation';

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
  user_agent: string
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

  const device = result.device.model ?? result.device.type ?? 'Unknown';
  const os = result.os.name ?? 'Unknown';
  const browser = result.browser.name ?? 'Unknown';

  const { city, region, country } = await getLocationByIp(ip);

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
