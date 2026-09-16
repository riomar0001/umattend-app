export interface RefreshTokenPayload {
  token_id: string;
  user_id: string;
  iat?: number;
  exp?: number;
}
export interface AccessTokenPayload {
  user_id: string;
  student_id: number | null;
  umindanao_email: string;
  first_name?: string | null;
  last_name?: string | null;
  department?: string | null;
  program?: string | null;
  role?: string;
  iat?: number;
  exp?: number;
}
