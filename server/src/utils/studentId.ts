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

/** A UM ID number is six digits. */
export const STUDENT_ID_DIGITS = 6;

const MIN_STUDENT_ID = 100000;
const MAX_STUDENT_ID = 999999;

/**
 * Whether a number is acceptable to *write* as an ID.
 *
 * Deliberately separate from isUsableStudentId. That one answers "does this
 * account have an ID on file" and has to stay permissive about whatever a row
 * already holds; this one gates what may be stored, and is strict.
 *
 * Six digits is measured, not assumed: every one of the 141 IDs on file is
 * exactly six long, spanning 484470 to 578769. Nothing is locked out by it.
 */
export const isAcceptableStudentId = (
  student_id: number | null | undefined
): student_id is number =>
  typeof student_id === 'number' &&
  Number.isSafeInteger(student_id) &&
  student_id >= MIN_STUDENT_ID &&
  student_id <= MAX_STUDENT_ID;

export const STUDENT_ID_RULE_MESSAGE = `ID number must be exactly ${STUDENT_ID_DIGITS} digits`;
