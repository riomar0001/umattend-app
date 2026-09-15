import jwt, { JwtPayload } from 'jsonwebtoken';
import crypto from 'crypto';
import { URLSearchParams } from 'url';
import {
  GOOGLE_CLIENT_ID,
  GOOGLE_CLIENT_SECRET,
  GOOGLE_REDIRECT_URI,
  GOOGLE_CLIENT,
} from '../../constants/google.constants';
import { JWT_GOOGLE_STATE_SECRET } from '../../constants/jwt.constants';

/**
 * A non-2xx from Google, carrying the response body.
 *
 * Google explains itself in that body — `{ error, error_description }` — and it
 * is the only thing that identifies the cause, so it must not be discarded.
 */
class GoogleApiError extends Error {
  constructor(
    readonly endpoint: 'token' | 'userinfo',
    readonly status: number,
    readonly body: string
  ) {
    super(`Google ${endpoint} endpoint returned ${status}`);
    this.name = 'GoogleApiError';
  }
}

const generatePKCE = () => {
  const codeVerifier = crypto.randomBytes(32).toString('base64url');
  const codeChallenge = crypto
    .createHash('sha256')
    .update(codeVerifier)
    .digest('base64url');
  return { codeVerifier, codeChallenge };
};

const generateGoogleAuthUrl = () => {
  const nonce = crypto.randomBytes(16).toString('hex');

  const { codeVerifier, codeChallenge } = generatePKCE();

  const statePayload = {
    nonce,
    timestamp: Date.now(),
    exp: Math.floor(Date.now() / 1000) + 5 * 60,
    codeVerifier,
  };

  if (!JWT_GOOGLE_STATE_SECRET) {
    throw new Error('JWT_SECRET is not defined in environment variables');
  }

  const state = jwt.sign(statePayload, JWT_GOOGLE_STATE_SECRET);

  const url = `https://accounts.google.com/o/oauth2/auth?client_id=${GOOGLE_CLIENT_ID}&redirect_uri=${GOOGLE_REDIRECT_URI}&scope=email%20profile&response_type=code&access_type=offline&prompt=consent&state=${state}&code_challenge=${codeChallenge}&code_challenge_method=S256&hd=umindanao.edu.ph`;

  return url;
};

const exchangeCodeForUserInfo = async (code: string, state: string) => {
  // Declared outside the try so the catch below can report whether the state
  // actually yielded a verifier.
  let codeVerifier: string | undefined;

  try {
    if (!JWT_GOOGLE_STATE_SECRET) {
      throw new Error('JWT_SECRET is not defined in environment variables');
    }

    const decoded = jwt.verify(state, JWT_GOOGLE_STATE_SECRET) as JwtPayload;

    codeVerifier = decoded.codeVerifier;

    if (!codeVerifier) {
      throw new Error('Invalid state - missing code verifier');
    }

    if (!GOOGLE_CLIENT_ID || !GOOGLE_CLIENT_SECRET || !GOOGLE_REDIRECT_URI) {
      throw new Error('Missing required environment variables');
    }

    const tokenRes = await fetch('https://oauth2.googleapis.com/token', {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({
        code: code,
        client_id: GOOGLE_CLIENT_ID,
        client_secret: GOOGLE_CLIENT_SECRET,
        redirect_uri: GOOGLE_REDIRECT_URI,
        grant_type: 'authorization_code',
        code_verifier: codeVerifier,
      }).toString(),
    });

    if (!tokenRes.ok) {
      // Google puts { error, error_description } here; it is the only thing
      // that identifies the cause, so surface it rather than a bare status.
      throw new GoogleApiError(
        'token',
        tokenRes.status,
        await tokenRes.text()
      );
    }

    const tokenData = (await tokenRes.json()) as { access_token?: string };
    const accessToken = tokenData.access_token;

    if (!accessToken) {
      throw new Error('No access token received from Google');
    }

    const userRes = await fetch(
      'https://www.googleapis.com/oauth2/v1/userinfo',
      {
        headers: { Authorization: `Bearer ${accessToken}` },
      }
    );

    if (!userRes.ok) {
      throw new GoogleApiError(
        'userinfo',
        userRes.status,
        await userRes.text()
      );
    }

    const profile = (await userRes.json()) as {
      id: string;
      email: string;
      name: string;
      picture: string;
    };

    return {
      google_id: profile.id,
      email: profile.email,
      name: profile.name,
      profile_picture: profile.picture,
    };
  } catch (error) {
    if (error instanceof GoogleApiError) {
      console.error('[google] request rejected', {
        endpoint: error.endpoint,
        status: error.status,
        google_error: error.body,
        // A mismatch between this and the value used to build the consent URL
        // is the usual cause of invalid_grant.
        redirect_uri_sent: GOOGLE_REDIRECT_URI,
        client_id_suffix: GOOGLE_CLIENT_ID?.slice(-24),
        code_prefix: code?.slice(0, 6),
        has_code_verifier: Boolean(codeVerifier),
      });
    } else {
      console.error('[google] exchange failed', {
        name: error instanceof Error ? error.name : typeof error,
        message: error instanceof Error ? error.message : String(error),
        stack: error instanceof Error ? error.stack : undefined,
      });
    }
    throw new Error('Failed to exchange code for user info');
  }
};

const verifyGoogleToken = async (token: string) => {
  try {
    const ticket = await GOOGLE_CLIENT.verifyIdToken({
      idToken: token,
      audience: GOOGLE_CLIENT_ID,
    });

    const payload = ticket.getPayload();

    if (!payload) {
      throw new Error('Invalid token payload');
    }

    if (
      payload.iss !== 'https://accounts.google.com' &&
      payload.iss !== 'accounts.google.com'
    ) {
      throw new Error('Invalid token issuer');
    }

    if (payload.exp < Date.now() / 1000) {
      throw new Error('Token expired');
    }

    if (payload.aud !== GOOGLE_CLIENT_ID) {
      throw new Error('Invalid audience');
    }

    return {
      google_id: payload.sub,
      email: payload.email,
      name: payload.name,
      profile_picture: payload.picture,
    };
  } catch (error) {
    console.error('Failed to verify Google token:', error);
    throw new Error('Invalid Google token');
  }
};

const validateState = (state: string) => {
  try {
    if (!JWT_GOOGLE_STATE_SECRET) {
      throw new Error('JWT_SECRET is not defined in environment variables');
    }

    const decoded = jwt.verify(state, JWT_GOOGLE_STATE_SECRET) as JwtPayload;

    if (!decoded.timestamp || !decoded.exp) {
      return false;
    }

    const now = Math.floor(Date.now() / 1000);

    if (decoded.exp < now) {
      return false;
    }

    const timeDiff = Date.now() - decoded.timestamp;
    if (timeDiff > 5 * 60 * 1000) {
      return false;
    }

    return true;
  } catch (error) {
    console.error('Failed to validate state parameter:', error);
    return false;
  }
};

const validateRedirectUri = (GOOGLE_REDIRECT_URI: string) => {
  if (!GOOGLE_REDIRECT_URI) {
    throw new Error(
      'GOOGLE_REDIRECT_URI is not defined in environment variables'
    );
  }

  return GOOGLE_REDIRECT_URI === GOOGLE_REDIRECT_URI;
};

const GoogleAuth = {
  generateGoogleAuthUrl,
  exchangeCodeForUserInfo,
  verifyGoogleToken,
  validateState,
  validateRedirectUri,
};

export default GoogleAuth;
