/**
 * Whether an account actually has an ID number on file.
 *
 * Checking `student_id === null` is not enough. Before the column was made
 * nullable, addresses that carried no number were stored as 0 — the result of
 * running extractStudentID's null through Number() — and those rows outlive the
 * migration whenever the old code is still deployed and writing new ones. A
 * strict null check reads 0 as a legitimate ID: the onboarding form never
 * appears, and the QR endpoint happily mints a token for student 0.
 *
 * Zero is never a real UM ID, so treat it, and anything else non-positive or
 * non-integral, as "no ID yet".
 */
export const isUsableStudentId = (
  student_id: number | null | undefined
): student_id is number =>
  typeof student_id === 'number' &&
  Number.isSafeInteger(student_id) &&
  student_id > 0;
