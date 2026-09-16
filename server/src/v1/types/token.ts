export type AccessTokenPayloadTypes = {
  user_id: string;
  umindanao_email: string;
  role: string;
  // null until an ID number exists for the account — see student.student_id.
  student_id?: number | null;
  name?: string;
  department?: string;
  program?: string;
  done_onboarding?: boolean;
  profile_picture?: string;
};

export type RefreshTokenData = {
  token: string;
  token_id: string;
  expires_at: Date;
};
