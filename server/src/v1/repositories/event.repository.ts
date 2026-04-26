import {
  NotFoundError,
  ForbiddenError,
  ConflictError,
  BadRequestError,
} from '@/utils/customErrors';
import prisma from '../../configs/prisma.config';
import {
  AddEventInterface,
  AddCheckInInterface,
  AddCheckOutInterface,
} from '../interface/event';
import { Prisma } from '@prisma/client';
import { setTimeout as sleep } from 'timers/promises';

// Retry on Postgres serialization failures (P2034) — Serializable isolation
// can roll back one of two concurrent transactions; the loser should retry.
const SERIALIZATION_RETRY_LIMIT = 3;
async function withSerializationRetry<T>(fn: () => Promise<T>): Promise<T> {
  let lastError: unknown;
  for (let attempt = 0; attempt < SERIALIZATION_RETRY_LIMIT; attempt++) {
    try {
      return await fn();
    } catch (error) {
      lastError = error;
      const isSerializationError =
        error instanceof Prisma.PrismaClientKnownRequestError &&
        error.code === 'P2034';
      if (!isSerializationError) {
        throw error;
      }
      await sleep(25 + Math.random() * 50);
    }
  }
  throw lastError;
}

const createEvent = async (event_data: AddEventInterface) => {
  return await prisma.$transaction(async (tx) => {
    const event = await tx.events.create({
      data: {
        ...event_data,
      },
    });

    await tx.organizers.create({
      data: {
        user_id: event.created_by,
        event_id: event.id,
        added_by: event.created_by,
      },
    });

    return event;
  });
};

const deleteEvent = async (eventId: string) => {
  return prisma.$transaction(async (tx) => {
    const existing = await tx.events.findUnique({
      where: { id: eventId },
    });

    if (!existing) {
      throw new Error('Event not found or already deleted.');
    }

    if (existing.is_done) {
      throw new Error('Cannot delete a completed event.');
    }

    // Count checks are inside the transaction so a concurrent check-in cannot
    // slip between the check and the DELETE.
    const checkinCount = await tx.attendance.count({
      where: { event_id: eventId },
    });
    if (checkinCount > 0) {
      throw new ForbiddenError(
        'Cannot delete event with existing check-ins. Please contact support.'
      );
    }

    if (existing.check_out_required) {
      const checkoutCount = await tx.attendance.count({
        where: { event_id: eventId, NOT: { check_out_at: null } },
      });
      if (checkoutCount > 0) {
        throw new ForbiddenError(
          'Cannot delete event with existing check-outs. Please contact support.'
        );
      }
    }

    return tx.events.delete({
      where: { id: eventId },
    });
  });
};

const updateEvent = async (eventId: string, event_data: AddEventInterface) => {
  return await prisma.events.update({
    where: { id: eventId },
    data: {
      ...event_data,
    },
  });
};

const getEventDetails = async (eventId: string) => {
  return await prisma.events.findUnique({
    where: { id: eventId },
  });
};

const postEvent = async (eventId: string) => {
  return await prisma.events.update({
    where: { id: eventId },
    data: { is_draft: false },
  });
};

const draftEvent = async (eventId: string) => {
  return await prisma.events.update({
    where: { id: eventId },
    data: { is_draft: true },
  });
};

const getAllEvents = async (includeDrafts = false) => {
  const events = await prisma.events.findMany({
    orderBy: { start_time: 'asc' },
    where: {
      is_done: false,
      ...(includeDrafts ? {} : { is_draft: false }),
    },
    include: {
      _count: {
        select: {
          attendance: true,
        },
      },
    },
  });

  // Single grouped query for checkout counts instead of one per event.
  const eventIds = events.map((e) => e.id);
  const checkoutCounts = eventIds.length
    ? await prisma.attendance.groupBy({
        by: ['event_id'],
        where: {
          event_id: { in: eventIds },
          NOT: { check_out_at: null },
        },
        _count: { _all: true },
      })
    : [];

  const checkoutMap = new Map(
    checkoutCounts.map((c) => [c.event_id, c._count._all])
  );

  return events.map((event) => {
    const { _count, ...rest } = event;
    return {
      ...rest,
      checkin_count: _count.attendance,
      checkout_count: checkoutMap.get(event.id) ?? 0,
    };
  });
};

const getAllPastEvents = async (includeDrafts = false) => {
  const events = await prisma.events.findMany({
    orderBy: { end_time: 'desc' },
    where: {
      is_done: true,
      ...(includeDrafts ? {} : { is_draft: false }),
    },
    include: {
      _count: {
        select: {
          attendance: true,
        },
      },
    },
  });

  const eventIds = events.map((e) => e.id);
  const checkoutCounts = eventIds.length
    ? await prisma.attendance.groupBy({
        by: ['event_id'],
        where: {
          event_id: { in: eventIds },
          NOT: { check_out_at: null },
        },
        _count: { _all: true },
      })
    : [];

  const checkoutMap = new Map(
    checkoutCounts.map((c) => [c.event_id, c._count._all])
  );

  return events.map((event) => {
    const { _count, ...rest } = event;
    return {
      ...rest,
      checkin_count: _count.attendance,
      checkout_count: checkoutMap.get(event.id) ?? 0,
    };
  });
};

const createCheckInEvent = async (attendance_data: AddCheckInInterface) => {
  const { event_id, student_id, check_in_at, check_in_by } = attendance_data;
  return await withSerializationRetry(() =>
    prisma.$transaction(
      async (tx) => {
        const event = await tx.events.findUnique({
          where: { id: event_id },
        });

        if (!event) {
          throw new NotFoundError('Event not found');
        }

        if (event.is_done) {
          throw new Error('Event has already ended');
        }

        // Capacity check is inside a Serializable transaction to prevent
        // overbooking — under READ COMMITTED two concurrent scans could both
        // read count < capacity and both insert.
        if (event.capacity !== null && event.capacity !== undefined) {
          const currentCount = await tx.attendance.count({
            where: { event_id },
          });
          if (currentCount >= event.capacity) {
            throw new Error('Event has reached its maximum capacity');
          }
        }

        const student = await tx.student.findUnique({
          where: { student_id },
        });

        if (!student) {
          throw new NotFoundError('Student not found');
        }

        if (
          event.department !== 'Open to all Departments' &&
          student.department !== event.department
        ) {
          throw new ForbiddenError(
            'This event is only open to students from the organizing department'
          );
        }

        const existingCheckIn = await tx.attendance.findFirst({
          where: {
            event_id,
            student_id,
          },
        });

        if (existingCheckIn) {
          throw new ConflictError(
            'Student is already checked in to this event'
          );
        }

        return await tx.attendance.create({
          data: {
            event_id,
            student_id,
            check_in_by,
            check_in_at: check_in_at ?? new Date().toISOString(),
          },
          include: {
            event: true,
            student: true,
            check_in_by_user: true,
          },
        });
      },
      { isolationLevel: Prisma.TransactionIsolationLevel.Serializable }
    )
  );
};

const createCheckOutEvent = async (attendance_data: AddCheckOutInterface) => {
  const { event_id, student_id, check_out_at, check_out_by } = attendance_data;
  return await prisma.$transaction(async (tx) => {
    const event = await tx.events.findUnique({
      where: { id: event_id },
    });

    if (!event) {
      throw new NotFoundError('Event not found');
    }

    if (event.is_done) {
      throw new Error('Event has already ended');
    }

    const student = await tx.student.findUnique({
      where: { student_id },
    });

    if (!student) {
      throw new NotFoundError('Student not found');
    }

    if (
      event.department !== 'Open to all Departments' &&
      student.department !== event.department
    ) {
      throw new ForbiddenError(
        'This event is only open to students from the organizing department'
      );
    }

    const existingCheckIn = await tx.attendance.findFirst({
      where: {
        event_id,
        student_id,
      },
    });

    if (!existingCheckIn) {
      throw new BadRequestError('Student has not checked in to this event');
    }

    if (existingCheckIn.check_out_at) {
      throw new ConflictError('Student has already checked out of this event');
    }

    return await tx.attendance.update({
      where: {
        id: existingCheckIn.id,
      },
      data: {
        check_out_at: check_out_at ?? new Date(),
        check_out_by,
      },
      include: {
        event: true,
        student: true,
        check_in_by_user: true,
        check_out_by_user: true,
      },
    });
  });
};

const checkOrganizer = async (user_id: string, event_id: string) => {
  return await prisma.organizers.findUnique({
    where: {
      user_id_event_id: {
        user_id,
        event_id,
      },
    },
  });
};

const addOrganizer = async (
  user_id: string,
  added_by: string,
  event_id: string
) => {
  return await prisma.organizers.create({
    data: {
      user_id,
      event_id,
      added_by: added_by,
    },
  });
};

const removeOrganizer = async (user_id: string, event_id: string) => {
  return await prisma.organizers.delete({
    where: {
      user_id_event_id: {
        user_id,
        event_id,
      },
    },
  });
};

const getOrganizersByEventId = async (event_id: string) => {
  const organizers = await prisma.organizers.findMany({
    where: {
      event_id,
    },
    include: {
      user: {
        select: {
          umindanao_email: true,
          student: {
            select: {
              student_id: true,
              name: true,
              department: true,
              program: true,
            },
          },
        },
      },
      addedBy: {
        select: {
          student: {
            select: {
              name: true,
            },
          },
        },
      },
    },
    orderBy: {
      created_at: 'asc',
    },
  });

  return organizers.map((organizer) => ({
    student_id: organizer.user.student?.student_id ?? null,
    name: organizer.user.student?.name ?? 'N/A',
    department: organizer.user.student?.department ?? 'N/A',
    program: organizer.user.student?.program ?? 'N/A',
    umindanao_email: organizer.user.umindanao_email,
    added_by: organizer.addedBy?.student?.name ?? 'System',
    added_at: organizer.created_at,
  }));
};

const getPaginatedAttendeesByEventId = async (
  event_id: string,
  page: number,
  limit: number,
  search?: string
) => {
  const skip = (page - 1) * limit;

  // Build where clause
  const whereClause: Prisma.attendanceWhereInput = {
    event_id,
  };

  if (search) {
    // Build OR conditions incrementally. Only include numeric equality
    // for student_id when the search term parses to a finite number.
    const orConditions: Prisma.attendanceWhereInput[] = [];

    orConditions.push({
      student: {
        name: {
          contains: search,
          mode: 'insensitive',
        },
      },
    });

    const parsedId = Number(search);
    if (!Number.isNaN(parsedId) && Number.isFinite(parsedId)) {
      orConditions.push({
        student: {
          student_id: {
            equals: parsedId,
          },
        },
      });
    }

    orConditions.push({
      student: {
        user: {
          umindanao_email: {
            contains: search,
            mode: 'insensitive',
          },
        },
      },
    });

    whereClause.OR = orConditions;
  }

  const [attendees, total] = await Promise.all([
    prisma.attendance.findMany({
      where: whereClause,
      include: {
        student: {
          select: {
            id: true,
            user_id: true,
            student_id: true,
            name: true,
            department: true,
            program: true,
            profile_picture: true,
            created_at: true,
            updated_at: true,
            user: {
              // ✅ now nested under student
              select: { umindanao_email: true },
            },
          },
        },
        check_in_by_user: {
          select: { id: true },
        },
        check_out_by_user: {
          select: { id: true },
        },
      },
      orderBy: {
        check_in_at: 'desc',
      },
      skip,
      take: limit,
    }),
    prisma.attendance.count({ where: whereClause }),
  ]);

  return { attendees, total };
};

/**
 * Mass check-out students for an event.
 *
 * Validation reads run outside the transaction (cheap, no locks held).
 * Updates run in batches, each in its own short transaction, so a large
 * event with thousands of attendees can't blow past the 30s tx timeout.
 */
const MASS_CHECKOUT_BATCH_SIZE = 200;

const massCheckOutStudents = async (
  event_id: string,
  student_ids: number[],
  check_out_by: string,
  check_out_at?: Date
) => {
  const event = await prisma.events.findUnique({ where: { id: event_id } });
  if (!event) {
    throw new NotFoundError('Event not found');
  }

  const departmentMismatch: number[] = [];

  if (event.department !== 'Open to all Departments') {
    const students = await prisma.student.findMany({
      where: { student_id: { in: student_ids } },
      select: { student_id: true, department: true },
    });

    const studentDeptMap = new Map(
      students.map((s) => [s.student_id, s.department])
    );

    for (const sid of student_ids) {
      const dept = studentDeptMap.get(sid);
      if (dept !== undefined && dept !== event.department) {
        departmentMismatch.push(sid);
      }
    }
  }

  const existing = await prisma.attendance.findMany({
    where: {
      event_id,
      student_id: { in: student_ids },
    },
    select: {
      id: true,
      student_id: true,
      check_out_at: true,
    },
  });

  const existingMap = new Map<number, (typeof existing)[number]>();
  existing.forEach((e) => existingMap.set(e.student_id, e));

  const notCheckedIn: number[] = [];
  const alreadyCheckedOut: number[] = [];
  const toUpdateIds: string[] = [];
  const departmentMismatchSet = new Set(departmentMismatch);

  for (const sid of student_ids) {
    if (departmentMismatchSet.has(sid)) {
      continue;
    }

    const rec = existingMap.get(sid);
    if (!rec) {
      notCheckedIn.push(sid);
      continue;
    }
    if (rec.check_out_at) {
      alreadyCheckedOut.push(sid);
      continue;
    }
    toUpdateIds.push(rec.id);
  }

  const checkoutTimestamp = check_out_at ?? new Date();

  // Process updates in batches, each in its own transaction. Avoids holding
  // locks for the whole operation and stays well within the tx timeout.
  for (let i = 0; i < toUpdateIds.length; i += MASS_CHECKOUT_BATCH_SIZE) {
    const batch = toUpdateIds.slice(i, i + MASS_CHECKOUT_BATCH_SIZE);
    await prisma.$transaction(
      async (tx) => {
        await tx.attendance.updateMany({
          where: { id: { in: batch } },
          data: {
            check_out_at: checkoutTimestamp,
            check_out_by,
          },
        });
      },
      { timeout: 60_000 }
    );
  }

  const updatedRecords = toUpdateIds.length
    ? await prisma.attendance.findMany({
        where: { id: { in: toUpdateIds } },
        include: {
          event: true,
          student: true,
          check_in_by_user: true,
          check_out_by_user: true,
        },
      })
    : [];

  return {
    updatedRecords,
    alreadyCheckedOut,
    notCheckedIn,
    departmentMismatch,
    updatedCount: updatedRecords.length,
  };
};

const getAttendeesByEventId = async (event_id: string) => {
  return await prisma.attendance.findMany({
    where: { event_id: event_id },
    include: {
      student: {
        select: {
          id: true,
          user_id: true,
          student_id: true,
          name: true,
          department: true,
          program: true,
          profile_picture: true,
          created_at: true,
          updated_at: true,
          user: {
            select: { umindanao_email: true },
          },
        },
      },
      check_in_by_user: { select: { id: true } },
      check_out_by_user: { select: { id: true } },
    },
    orderBy: { check_in_at: 'desc' },
  });
};

const getEventAttendanceCount = async (event_id: string) => {
  const event = await prisma.events.findUnique({
    where: { id: event_id },
  });

  if (!event) {
    throw new NotFoundError('Event not found');
  }

  // Both counts run in a single transaction so they're a consistent snapshot
  // — without this, a check-out between the two calls makes the numbers lie.
  const [totalAttendance, totalCheckedOut] = await prisma.$transaction([
    prisma.attendance.count({ where: { event_id } }),
    prisma.attendance.count({
      where: {
        event_id,
        NOT: { check_out_at: null },
      },
    }),
  ]);

  return { totalAttendance, totalCheckedOut };
};

const getEventCheckoutCount = async (event_id: string) => {
  return await prisma.attendance.count({
    where: {
      event_id,
      NOT: {
        check_out_at: null,
      },
    },
  });
};

const getEventCheckinCount = async (event_id: string) => {
  return await prisma.attendance.count({
    where: { event_id },
  });
};

const checkIfUserAttended = async (event_id: string, student_id: number) => {
  const [event, attendance] = await Promise.all([
    prisma.events.findUnique({
      where: { id: event_id },
      select: { check_out_required: true },
    }),
    prisma.attendance.findFirst({
      where: {
        event_id,
        student_id,
      },
      select: {
        id: true,
        check_in_at: true,
        check_out_at: true,
      },
    }),
  ]);

  if (!attendance) {
    return null;
  }

  return {
    id: attendance.id,
    check_in_at: attendance.check_in_at,
    check_out_at: event?.check_out_required ? attendance.check_out_at : false,
  };
};

/**
 * Directly check in a student to an event using their numeric student_id.
 * This is used by organizers to manually check in a student from the
 * Attendance Records table — no QR code decoding required.
 */
const checkInStudentById = async (
  event_id: string,
  student_id: number,
  check_in_by: string,
  check_in_at?: Date
) => {
  return await withSerializationRetry(() =>
    prisma.$transaction(
      async (tx) => {
        const event = await tx.events.findUnique({
          where: { id: event_id },
        });

        if (!event) {
          throw new NotFoundError('Event not found');
        }

        const student = await tx.student.findUnique({
          where: { student_id },
        });

        if (!student) {
          throw new NotFoundError('Student not found');
        }

        if (
          event.department !== 'Open to all Departments' &&
          student.department !== event.department
        ) {
          throw new ForbiddenError(
            'This event is only open to students from the organizing department'
          );
        }

        const existingCheckIn = await tx.attendance.findFirst({
          where: { event_id, student_id },
        });

        if (existingCheckIn) {
          throw new ConflictError(
            'Student has already checked in to this event'
          );
        }

        if (event.capacity !== null && event.capacity !== undefined) {
          const currentCount = await tx.attendance.count({
            where: { event_id },
          });
          if (currentCount >= event.capacity) {
            throw new Error('Event has reached its maximum capacity');
          }
        }

        return await tx.attendance.create({
          data: {
            event_id,
            student_id,
            check_in_at: check_in_at ?? new Date(),
            check_in_by,
          },
          include: {
            event: true,
            student: true,
            check_in_by_user: true,
            check_out_by_user: true,
          },
        });
      },
      { isolationLevel: Prisma.TransactionIsolationLevel.Serializable }
    )
  );
};

/**
 * Directly check out a student from an event using their numeric student_id.
 * This is used by organizers to manually check out a student from the
 * Attendance Records table — no QR code decoding required.
 */
const checkOutStudentById = async (
  event_id: string,
  student_id: number,
  check_out_by: string,
  check_out_at?: Date
) => {
  return await prisma.$transaction(async (tx) => {
    const event = await tx.events.findUnique({
      where: { id: event_id },
    });

    if (!event) {
      throw new NotFoundError('Event not found');
    }

    const student = await tx.student.findUnique({
      where: { student_id },
    });

    if (!student) {
      throw new NotFoundError('Student not found');
    }

    if (
      event.department !== 'Open to all Departments' &&
      student.department !== event.department
    ) {
      throw new ForbiddenError(
        'This event is only open to students from the organizing department'
      );
    }

    const existingCheckIn = await tx.attendance.findFirst({
      where: { event_id, student_id },
    });

    if (!existingCheckIn) {
      throw new BadRequestError('Student has not checked in to this event');
    }

    if (existingCheckIn.check_out_at) {
      throw new ConflictError('Student has already checked out of this event');
    }

    return await tx.attendance.update({
      where: { id: existingCheckIn.id },
      data: {
        check_out_at: check_out_at ?? new Date(),
        check_out_by,
      },
      include: {
        event: true,
        student: true,
        check_in_by_user: true,
        check_out_by_user: true,
      },
    });
  });
};

const eventRepository = {
  createEvent,
  deleteEvent,
  updateEvent,
  getEventDetails,
  createCheckInEvent,
  createCheckOutEvent,
  checkInStudentById,
  checkOutStudentById,
  addOrganizer,
  removeOrganizer,
  getOrganizersByEventId,
  checkOrganizer,
  getAllEvents,
  getAllPastEvents,
  getAttendeesByEventId,
  getEventCheckoutCount,
  getEventCheckinCount,
  getPaginatedAttendeesByEventId,
  checkIfUserAttended,
  getEventAttendanceCount,
  massCheckOutStudents,
  postEvent,
  draftEvent,
};

export default eventRepository;
