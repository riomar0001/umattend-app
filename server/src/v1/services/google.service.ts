import axios from 'axios';
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
  try {
    if (!JWT_GOOGLE_STATE_SECRET) {
      throw new Error('JWT_SECRET is not defined in environment variables');
    }

    const decoded = jwt.verify(state, JWT_GOOGLE_STATE_SECRET) as JwtPayload;

    const codeVerifier = decoded.codeVerifier;

    if (!codeVerifier) {
      throw new Error('Invalid state - missing code verifier');
    }

    if (!GOOGLE_CLIENT_ID || !GOOGLE_CLIENT_SECRET || !GOOGLE_REDIRECT_URI) {
      throw new Error('Missing required environment variables');
    }

    const tokenRes = await axios.post(
      'https://oauth2.googleapis.com/token',
      new URLSearchParams({
        code: code,
        client_id: GOOGLE_CLIENT_ID,
        client_secret: GOOGLE_CLIENT_SECRET,
        redirect_uri: GOOGLE_REDIRECT_URI,
        grant_type: 'authorization_code',
        code_verifier: codeVerifier,
      }),
      {
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded',
        },
      }
    );

    const accessToken = tokenRes.data.access_token;

    if (!accessToken) {
      throw new Error('No access token received from Google');
    }

    const userRes = await axios.get(
      'https://www.googleapis.com/oauth2/v1/userinfo',
      {
        headers: { Authorization: `Bearer ${accessToken}` },
      }
    );

    return {
      google_id: userRes.data.id,
      email: userRes.data.email,
      name: userRes.data.name,
      profile_picture: userRes.data.picture,
    };
  } catch (error) {
    console.log(error);
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
