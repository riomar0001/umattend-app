export const sanitizeKey = (key: string) => key.replace(/[^a-zA-Z0-9:_-]/g, '');

/**
 * Pulls the ID number out of an address shaped like `s.nolasco.576804@…`.
 *
 * Returns null for the addresses that carry no number at all —
 * `tan.jessiejames@umindanao.edu.ph` is a real, valid account. Callers must
 * keep that null: coercing it with Number() yields 0, which is a plausible-
 * looking ID that every such account would then share.
 */
export const extractStudentID = (email: string): number | null => {
  const match = email.match(/\.([0-9]+)@umindanao\.edu\.ph$/);
  if (!match) {
    return null;
  }

  const student_id = Number(match[1]);
  return Number.isSafeInteger(student_id) && student_id > 0 ? student_id : null;
};
