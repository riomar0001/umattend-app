import { isAcceptableStudentId, STUDENT_ID_DIGITS } from './studentId';

export const sanitizeKey = (key: string) => key.replace(/[^a-zA-Z0-9:_-]/g, '');

/**
 * Pulls the ID number out of an address shaped like `s.nolasco.576804@…`.
 *
 * Matches exactly six digits, the same rule the form enforces, so the two
 * cannot disagree about what a valid ID is. An address carrying some other
 * run of digits is treated as carrying none and falls through to onboarding,
 * which is the safe direction: a wrong ID pulled from an address is silent,
 * whereas a missing one is a question the student can answer.
 *
 * Returns null for the addresses that carry no number at all —
 * `tan.jessiejames@umindanao.edu.ph` is a real, valid account. Callers must
 * keep that null: coercing it with Number() yields 0, which is a plausible-
 * looking ID that every such account would then share.
 */
export const extractStudentID = (email: string): number | null => {
  const match = email.match(
    new RegExp(`\\.([0-9]{${STUDENT_ID_DIGITS}})@umindanao\\.edu\\.ph$`)
  );
  if (!match) {
    return null;
  }

  const student_id = Number(match[1]);
  return isAcceptableStudentId(student_id) ? student_id : null;
};
