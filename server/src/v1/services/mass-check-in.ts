import {
  AppError,
  BadRequestError,
  ConflictError,
} from '../../utils/customErrors';

export const MASS_CHECK_IN_BATCH_SIZE = 25;

export function validateStudentIds(value: unknown): string[] {
  if (
    !Array.isArray(value) ||
    value.length === 0 ||
    value.length > MASS_CHECK_IN_BATCH_SIZE
  ) {
    throw new BadRequestError(
      `Provide between 1 and ${MASS_CHECK_IN_BATCH_SIZE} student IDs`
    );
  }
  if (!value.every((id) => typeof id === 'string' && /^\d{6}$/.test(id))) {
    throw new BadRequestError('Each student ID must be a 6-digit string');
  }
  return [...new Set(value)] as string[];
}

export async function runMassCheckIn(
  studentIds: string[],
  checkIn: (studentId: number) => Promise<unknown>
) {
  const results: {
    student_id: string;
    status: 'checked_in' | 'skipped' | 'failed';
    message: string;
  }[] = [];
  // Preserve capacity ordering and avoid a burst of database and email requests.
  for (const studentId of studentIds) {
    try {
      await checkIn(Number(studentId));
      results.push({
        student_id: studentId,
        status: 'checked_in',
        message: 'Checked in successfully',
      });
    } catch (error) {
      results.push({
        student_id: studentId,
        status: error instanceof ConflictError ? 'skipped' : 'failed',
        message:
          error instanceof AppError && error.statusCode < 500
            ? error.message
            : 'Unable to confirm check-in. Refresh attendance before retrying.',
      });
    }
  }
  return { results };
}
