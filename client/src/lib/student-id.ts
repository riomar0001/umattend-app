/**
 * The shape a UM ID number has to take.
 *
 * Mirrors isAcceptableStudentId on the server, which is the authority — this
 * exists so the form can reject a bad value before a round trip, not so the
 * client can decide what is valid. Six digits is measured rather than assumed:
 * every ID on file is exactly six long.
 */
export const STUDENT_ID_DIGITS = 6;

export const STUDENT_ID_PATTERN = new RegExp(`^\\d{${STUDENT_ID_DIGITS}}$`);

export const STUDENT_ID_RULE_MESSAGE = `ID number must be exactly ${STUDENT_ID_DIGITS} digits`;
