export type CreateUserTypes = {
  umindanao_email: string;
  google_id: string;
  name: string;
  // null when the umindanao.edu.ph address carried no ID number.
  student_id: number | null;
  profile_picture: string;
  role: string;
};

export type OnboardUserTypes = {
  department: string;
  program: string;
};

export type updateUserTypes = {
  role: string;
};
