import jwt from 'jsonwebtoken';
import { JWT_ATTENDANCE_TOKEN_SECRET } from '@/constants/jwt.constants';

/**
 * Why a QR code was rejected.
 *
 * Expiry is separated from every other failure because it is the only one the
 * scanning staff can act on: an attendance token lives for JWT_ATTENDANCE_TOKEN_TTL
 * seconds, so a student whose screen has been open a while simply needs to
 * refresh it. Collapsing that into a generic failure sends people away thinking
 * their registration is broken.
 */
export type QRFailureReason = 'expired' | 'invalid';

export type QRVerification =
  | { valid: true; student_id: string; reason: null }
  | { valid: false; student_id: null; reason: QRFailureReason };

export const decodeAndVerifyQR = (qrCode: string): QRVerification => {
  try {
    const payload = jwt.verify(qrCode, JWT_ATTENDANCE_TOKEN_SECRET) as {
      student_id: number;
    };
    return {
      valid: true,
      student_id: String(payload.student_id),
      reason: null,
    };
  } catch (error) {
    // Anything else — bad signature, malformed token, a QR from another system —
    // is reported as invalid rather than described, so a failed verification
    // cannot be used to probe the signing key.
    const reason: QRFailureReason =
      error instanceof jwt.TokenExpiredError ? 'expired' : 'invalid';
    return { valid: false, student_id: null, reason };
  }
};

/** User-facing message for a rejected QR code. */
export const qrFailureMessage = (reason: QRFailureReason): string =>
  reason === 'expired'
    ? 'This QR code has expired. Ask the student to refresh it and scan again.'
    : 'Invalid QR code.';
