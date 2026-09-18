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
import { Prisma } from '@/generated/prisma/client';
import { mutateInBatches, queryInBatches } from '@/utils/d1';

// The Serializable-isolation retry helper (P2034) that used to live here is
// gone. D1 implements neither transactions nor isolation levels, so it could
// never fire — keeping it would imply a protection that does not exist.
// Each guard it wrapped is now a single conditional statement; see the
// comments on createCheckInEvent and createCheckOutEvent.

const createEvent = async (event_data: AddEventInterface) => {
  // A nested write keeps the event and its first organizer in one Prisma call.
  // D1 still executes the underlying INSERTs separately, so if the organizer
  // row fails we delete the event rather than leave one nobody can administer.
  try {
    return await prisma.events.create({
      data: {
        ...event_data,
        organizers: {
          create: {
            user_id: event_data.created_by,
            added_by: event_data.created_by,
          },
        },
      },
    });
  } catch (error) {
    const orphan = await prisma.events.findFirst({
      where: { created_by: event_data.created_by, organizers: { none: {} } },
      orderBy: { created_at: 'desc' },
    });

    if (orphan) {
      await prisma.events.delete({ where: { id: orphan.id } });
    }

    throw error;
  }
};

const deleteEvent = async (eventId: string) => {
  // One conditional DELETE instead of read-then-delete: `count` tells us
  // whether the row existed, so the transaction that used to make those two
  // steps atomic is no longer needed.
  const existing = await prisma.events.findUnique({ where: { id: eventId } });

  const { count } = await prisma.events.deleteMany({ where: { id: eventId } });

  if (count === 0) {
    throw new Error('Event not found or already deleted.');
  }

  return existing;
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

  // One grouped query per batch instead of one per event. Batched because this
  // list is not paginated: D1 caps a statement at 100 bound parameters, so an
  // account with a hundred events would otherwise fail outright. See utils/d1.
  const eventIds = events.map((e) => e.id);
  const checkoutCounts = await queryInBatches(eventIds, (batch) =>
    prisma.attendance.groupBy({
      by: ['event_id'],
      where: {
        event_id: { in: batch },
        NOT: { check_out_at: null },
      },
      _count: { _all: true },
    })
  );

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

  // Batched for the same reason as getAllEvents above — the past-events list
  // is unpaginated and only grows.
  const eventIds = events.map((e) => e.id);
  const checkoutCounts = await queryInBatches(eventIds, (batch) =>
    prisma.attendance.groupBy({
      by: ['event_id'],
      where: {
        event_id: { in: batch },
        NOT: { check_out_at: null },
      },
      _count: { _all: true },
    })
  );

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
  const event = await prisma.events.findUnique({ where: { id: event_id } });

  if (!event) {
    throw new NotFoundError('Event not found');
  }

  if (event.is_done) {
    throw new Error('Event has already ended');
  }

  const student = await prisma.student.findUnique({ where: { student_id } });

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

  // Cheap pre-check so a full event rejects without writing anything. It is not
  // the real guard — see the capacity reconciliation below.
  if (event.capacity !== null && event.capacity !== undefined) {
    const currentCount = await prisma.attendance.count({ where: { event_id } });
    if (currentCount >= event.capacity) {
      throw new Error('Event has reached its maximum capacity');
    }
  }

  let attendance;
  try {
    attendance = await prisma.attendance.create({
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
  } catch (error) {
    // The @@unique([event_id, student_id]) index now rejects a double check-in
    // that the old find-then-insert pair could only catch inside a Serializable
    // transaction — an isolation level D1 does not implement.
    if (
      error instanceof Prisma.PrismaClientKnownRequestError &&
      error.code === 'P2002'
    ) {
      throw new ConflictError('Student is already checked in to this event');
    }
    throw error;
  }

  // Capacity cannot be enforced by a constraint, and D1 gives us no transaction
  // to hold the count steady across the check above. Instead, insert first and
  // then work out this row's position in the event: if concurrent check-ins
  // pushed it past capacity, withdraw it. This can never overbook — at worst a
  // simultaneous pair both yield and a slot goes unfilled.
  if (event.capacity !== null && event.capacity !== undefined) {
    const position = await prisma.attendance.count({
      where: { event_id, created_at: { lte: attendance.created_at } },
    });

    if (position > event.capacity) {
      await prisma.attendance.delete({ where: { id: attendance.id } });
      throw new Error('Event has reached its maximum capacity');
    }
  }

  return attendance;
};

const createCheckOutEvent = async (attendance_data: AddCheckOutInterface) => {
  const { event_id, student_id, check_out_at, check_out_by } = attendance_data;
  const event = await prisma.events.findUnique({ where: { id: event_id } });

  if (!event) {
    throw new NotFoundError('Event not found');
  }

  if (event.is_done) {
    throw new Error('Event has already ended');
  }

  const student = await prisma.student.findUnique({ where: { student_id } });

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

  // Claim the check-out with a single conditional UPDATE. Matching on
  // `check_out_at: null` means two concurrent scans cannot both succeed —
  // whichever loses sees count === 0 and reports the conflict — which is the
  // guarantee the enclosing transaction used to give.
  const { count } = await prisma.attendance.updateMany({
    where: { event_id, student_id, check_out_at: null },
    data: {
      check_out_at: check_out_at ?? new Date(),
      check_out_by,
    },
  });

  if (count === 0) {
    const existing = await prisma.attendance.findFirst({
      where: { event_id, student_id },
    });

    if (!existing) {
      throw new BadRequestError('Student has not checked in to this event');
    }

    throw new ConflictError('Student has already checked out of this event');
  }

  return prisma.attendance.findFirstOrThrow({
    where: { event_id, student_id },
    include: {
      event: true,
      student: true,
      check_in_by_user: true,
      check_out_by_user: true,
    },
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
 * Every query that filters on the caller's `student_ids` — or on the attendance
 * ids derived from them — is batched, because D1 rejects a statement carrying
 * more than 100 bound parameters and the list is client-supplied. Batch size
 * comes from `utils/d1`; the old local constant was 200, over the cap.
 */

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
    // `student_ids` comes straight from the request body, so its length is
    // whatever the caller sent — batched to stay inside D1's bound-parameter
    // cap. Same for the attendance lookup below.
    const students = await queryInBatches(student_ids, (batch) =>
      prisma.student.findMany({
        where: { student_id: { in: batch } },
        select: { student_id: true, department: true },
      })
    );

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

  const existing = await queryInBatches(student_ids, (batch) =>
    prisma.attendance.findMany({
      where: {
        event_id,
        student_id: { in: batch },
      },
      select: {
        id: true,
        student_id: true,
        check_out_at: true,
      },
    })
  );

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

  // Batched, to keep each statement inside D1's 100 bound-parameter cap. The
  // previous batch size of 200 was over it: this statement binds one parameter
  // per id *plus* check_out_at and check_out_by, so anything above 98 ids was
  // rejected with "too many SQL variables" — i.e. every mass check-out of a
  // hundred students or more. See utils/d1.
  //
  // The transaction wrapper is gone: it only ever held a single `updateMany`,
  // which is atomic on its own.
  //
  // `check_out_at: null` is re-asserted rather than trusting the read that
  // built `toUpdateIds` — without a transaction an individual check-out could
  // have landed in between, and it must not be silently overwritten.
  await mutateInBatches(toUpdateIds, (batch) =>
    prisma.attendance.updateMany({
      where: { id: { in: batch }, check_out_at: null },
      data: {
        check_out_at: checkoutTimestamp,
        check_out_by,
      },
    })
  );

  const updatedRecords = await queryInBatches(toUpdateIds, (batch) =>
    prisma.attendance.findMany({
      where: { id: { in: batch } },
      include: {
        event: true,
        student: true,
        check_in_by_user: true,
        check_out_by_user: true,
      },
    })
  );

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
  const event = await prisma.events.findUnique({ where: { id: event_id } });

  if (!event) {
    throw new NotFoundError('Event not found');
  }

  const student = await prisma.student.findUnique({ where: { student_id } });

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

  // Cheap pre-check; the real guard is the position check after the insert.
  if (event.capacity !== null && event.capacity !== undefined) {
    const currentCount = await prisma.attendance.count({ where: { event_id } });
    if (currentCount >= event.capacity) {
      throw new Error('Event has reached its maximum capacity');
    }
  }

  let attendance;
  try {
    attendance = await prisma.attendance.create({
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
  } catch (error) {
    // @@unique([event_id, student_id]) replaces the find-then-insert guard.
    if (
      error instanceof Prisma.PrismaClientKnownRequestError &&
      error.code === 'P2002'
    ) {
      throw new ConflictError('Student has already checked in to this event');
    }
    throw error;
  }

  // Same reconciliation as createCheckInEvent: never overbook, at worst yield.
  if (event.capacity !== null && event.capacity !== undefined) {
    const position = await prisma.attendance.count({
      where: { event_id, created_at: { lte: attendance.created_at } },
    });

    if (position > event.capacity) {
      await prisma.attendance.delete({ where: { id: attendance.id } });
      throw new Error('Event has reached its maximum capacity');
    }
  }

  return attendance;
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
  const event = await prisma.events.findUnique({ where: { id: event_id } });

  if (!event) {
    throw new NotFoundError('Event not found');
  }

  const student = await prisma.student.findUnique({ where: { student_id } });

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

  // Conditional UPDATE claims the check-out atomically; see createCheckOutEvent.
  const { count } = await prisma.attendance.updateMany({
    where: { event_id, student_id, check_out_at: null },
    data: {
      check_out_at: check_out_at ?? new Date(),
      check_out_by,
    },
  });

  if (count === 0) {
    const existing = await prisma.attendance.findFirst({
      where: { event_id, student_id },
    });

    if (!existing) {
      throw new BadRequestError('Student has not checked in to this event');
    }

    throw new ConflictError('Student has already checked out of this event');
  }

  return prisma.attendance.findFirstOrThrow({
    where: { event_id, student_id },
    include: {
      event: true,
      student: true,
      check_in_by_user: true,
      check_out_by_user: true,
    },
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
