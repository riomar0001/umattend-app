export interface GetStudentByIdInterface {
  user_id: string;
  id: string;
  created_at: Date;
  updated_at: Date;
  // null when the account's address carried no ID number and onboarding has
  // not supplied one yet. Attendance is unreachable until it does.
  student_id: number | null;
  name: string;
  umindanao_email?: string;
  department: string | null;
  program: string | null;
  profile_picture: string;
}

export interface GetStudentWithAttendanceInterface
  extends GetStudentByIdInterface {
  check_in_at: Date | null;
  check_out_at: Date | null;
  check_in_by: string | null;
  check_out_by: string | null;
}

export interface GetStudentsByEventIdInterface {
  student: GetStudentWithAttendanceInterface;
}
