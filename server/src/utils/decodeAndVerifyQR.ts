import jwt from 'jsonwebtoken';
import { JWT_ATTENDANCE_TOKEN_SECRET } from '@/constants/jwt.constants';

export const decodeAndVerifyQR = (
  qrCode: string
): { valid: boolean; student_id: string | null } => {
  try {
    const payload = jwt.verify(qrCode, JWT_ATTENDANCE_TOKEN_SECRET) as {
      student_id: number;
    };
    return { valid: true, student_id: String(payload.student_id) };
  } catch {
    return { valid: false, student_id: null };
  }
};
