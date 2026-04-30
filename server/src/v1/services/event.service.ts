import eventRepository from '../repositories/event.repository';
import {
  AddCheckInInterface,
  AddCheckOutInterface,
  AddEventInterface,
  GetAllEventsInterface,
  GetEventDetailsWithEditByIdInterface,
} from '../interface/event';
import { Prisma } from '@prisma/client';
import { NODE_ENV } from '../../constants/app.constants';
import {
  AppError,
  NotFoundError,
  ForbiddenError,
  NoCheckoutRequiredError,
  OrganizerError,
  ConflictError,
  BadRequestError,
} from '@/utils/customErrors';
import { events } from '@prisma/client';
import { endEventStatusQueue } from '../queues/endEvent.queue';
import authRepository from '../repositories/auth.repository';
import { startEventStatusQueue } from '../queues/startEvent.queue';
import { GetStudentsByEventIdInterface } from '../interface/student';
import studentRepository from '../repositories/student.repository';
import { CHECK_IN_EMAIL } from '../template/checkIn.email';
import { sendEmail } from './email.service';
import { CHECK_OUT_EMAIL } from '../template/checkOut.email';
import { invalidateOrganizerCache } from '../middlewares/checkOrganizer.middleware';

const addEvent = async (event_data: AddEventInterface) => {
  try {
    const event = await eventRepository.createEvent(event_data);

    await scheduleStartEventStatusJob(event);
    await scheduleEndEventStatusJob(event);

    return event;
  } catch (error) {
    if (error instanceof Prisma.PrismaClientKnownRequestError) {
      if (error.code === 'P2002') {
        throw new ConflictError('An event with conflicting unique fields already exists');
      }
      if (error.code === 'P2003') {
        throw new BadRequestError('Invalid reference: a related resource does not exist');
      }
    }

    if (error instanceof Prisma.PrismaClientValidationError) {
      throw new BadRequestError('Invalid event data provided');
    }

    throw error;
  }
};

const deleteEvent = async (eventId: string): Promise<boolean> => {
  const event = await eventRepository.getEventDetails(eventId);

  if (!event) {
    throw new NotFoundError('Event not found');
  }

  if (!event.is_draft) {
    throw new ForbiddenError('Event must be set to draft before it can be deleted.');
  }

  // Count checks are enforced atomically inside the repository transaction
  await eventRepository.deleteEvent(eventId);
  return true;
};

const postEvent = async (eventId: string): Promise<void> => {
  const event = await eventRepository.getEventDetails(eventId);
  if (!event) {
    throw new NotFoundError('Event not found');
  }
  await eventRepository.postEvent(eventId);
};

const draftEvent = async (eventId: string): Promise<void> => {
  const event = await eventRepository.getEventDetails(eventId);
  if (!event) {
    throw new NotFoundError('Event not found');
  }
  await eventRepository.draftEvent(eventId);
};

const updateEvent = async (eventId: string, event_data: AddEventInterface) => {
  const event = await eventRepository.getEventDetails(eventId);

  if (!event) {
    throw new NotFoundError('Event not found');
  }
  if (event.created_by !== event_data.created_by) {
    throw new ForbiddenError('You are not authorized to update this event');
  }
  const updated_event = await eventRepository.updateEvent(eventId, event_data);

  // Remove existing jobs best-effort — ignore "job not found" errors so a
  // concurrent update or missing job doesn't abort the whole operation.
  await Promise.allSettled([
    startEventStatusQueue.remove(`event-start-${updated_event.id}`),
    endEventStatusQueue.remove(`event-done-${updated_event.id}`),
  ]);

  await Promise.all([
    scheduleStartEventStatusJob(updated_event),
    scheduleEndEventStatusJob(updated_event),
  ]);

  return updated_event;
};

const createCheckInEvent = async (attendance_data: AddCheckInInterface) => {
  try {
    if (!attendance_data.student_id) {
      throw new NotFoundError('Student ID is required');
    }

    const checkedIn = await eventRepository.createCheckInEvent(attendance_data);

    if (!checkedIn) {
      throw new Error('Failed to create check-in record');
    }

    const studentbyUserId = await studentRepository.getUserByStudentId(
      attendance_data.student_id
    );

    if (!studentbyUserId) {
      throw new NotFoundError('Student user not found');
    }

    const checkInBy = checkedIn.check_in_by_user?.id
      ? await studentRepository.getStudentByUserId(
          checkedIn.check_in_by_user.id
        )
      : null;

    const checkInByName = checkInBy ? checkInBy.name : 'Organizer/Admin';

    try {
      await sendEmail(
        studentbyUserId?.umindanao_email,
        'Event Check-In Successful',
        CHECK_IN_EMAIL.replace('{{name}}', checkedIn.student.name)
          .replace('{{event_name}}', checkedIn.event.title)
          .replace('{{event_location}}', checkedIn.event.location)
          .replace(
            '{{event_date_and_time}}',
            checkedIn.check_in_at.toLocaleString('en-US', {
              timeZone: 'Asia/Manila',
            })
          )
          .replace('{{checked_in_by}}', checkInByName)
      );
    } catch (err) {
      console.warn(
        'Failed to send check-in email for student',
        attendance_data.student_id,
        err
      );
    }

    return checkedIn;
  } catch (error: unknown) {
    if (error instanceof AppError) {
      throw error;
    }
    if (error instanceof Prisma.PrismaClientKnownRequestError) {
      if (error.code === 'P2002') {
        throw new Error('Unique constraint failed');
      }
      if (error.code === 'P2003') {
        throw new Error('Foreign key constraint failed');
      }
    }
    if (
      error instanceof Prisma.PrismaClientValidationError &&
      NODE_ENV === 'DEVELOPMENT'
    ) {
      throw new Error('Validation failed: ' + error.message);
    }
    console.error(error);
    return false;
  }
};

const createCheckOutEvent = async (attendance_data: AddCheckOutInterface) => {
  try {
    if (!attendance_data.event_id) {
      throw new NotFoundError('Event ID is required');
    }
    const eventDetails = await eventRepository.getEventDetails(
      attendance_data.event_id
    );
    if (!eventDetails) {
      throw new NotFoundError('Event not found');
    }
    if (!eventDetails.check_out_required) {
      throw new NoCheckoutRequiredError(
        'This event does not require check-out'
      );
    }

    const checkedOut =
      await eventRepository.createCheckOutEvent(attendance_data);

    if (!checkedOut) {
      throw new Error('Failed to create check-out record');
    }

    if (!checkedOut.check_out_by_user) {
      throw new NotFoundError('Check-out record not found');
    }

    if (!checkedOut.check_out_at) {
      throw new NotFoundError('Check-out date not found');
    }

    const studentbyUserId = await studentRepository.getUserByStudentId(
      attendance_data.student_id
    );

    if (!studentbyUserId) {
      throw new NotFoundError('Student user not found');
    }

    const checkOutBy = checkedOut.check_out_by_user?.id
      ? await studentRepository.getStudentByUserId(
          checkedOut.check_out_by_user.id
        )
      : null;

    const checkOutByName = checkOutBy ? checkOutBy.name : 'Organizer/Admin';

    try {
      await sendEmail(
        studentbyUserId?.umindanao_email,
        'Event Check-Out Successful',
        CHECK_OUT_EMAIL.replace('{{name}}', checkedOut.student.name)
          .replace('{{event_name}}', checkedOut.event.title)
          .replace('{{event_location}}', checkedOut.event.location)
          .replace(
            '{{event_date_and_time}}',
            checkedOut.check_out_at.toLocaleString('en-US', {
              timeZone: 'Asia/Manila',
            })
          )
          .replace('{{checked_out_by}}', checkOutByName)
      );
    } catch (err) {
      console.warn(
        'Failed to send check-out email for student',
        attendance_data.student_id,
        err
      );
    }

    return checkedOut;
  } catch (error: unknown) {
    if (error instanceof AppError) {
      throw error;
    }
    if (error instanceof Prisma.PrismaClientKnownRequestError) {
      if (error.code === 'P2002') {
        throw new Error('Unique constraint failed');
      }
      if (error.code === 'P2003') {
        throw new Error('Foreign key constraint failed');
      }
    }
    if (
      error instanceof Prisma.PrismaClientValidationError &&
      NODE_ENV === 'DEVELOPMENT'
    ) {
      throw new Error('Validation failed: ' + error.message);
    }
    console.error(error);
    return false;
  }
};

const massCheckOutStudents = async (
  event_id: string,
  student_ids: number[],
  check_out_by: string,
  checkout_time?: string | Date
) => {
  try {
    if (!event_id) {
      throw new NotFoundError('Event ID is required');
    }

    const eventDetails = await eventRepository.getEventDetails(event_id);
    if (!eventDetails) {
      throw new NotFoundError('Event not found');
    }
    if (!eventDetails.check_out_required) {
      throw new NoCheckoutRequiredError(
        'This event does not require check-out'
      );
    }

    // Determine the check_out_at to use for the batch.
    let checkOutAt: Date;

    if (checkout_time instanceof Date) {
      checkOutAt = checkout_time;
    } else if (
      typeof checkout_time === 'string' &&
      /^\d{1,2}:\d{2}$/.test(checkout_time)
    ) {
      // If given as HH:MM, interpret as local time in Philippines (Asia/Manila, UTC+08:00)
      // and apply it to the event date (prefer start_time, else today).
      const baseDate = eventDetails.start_time
        ? new Date(eventDetails.start_time)
        : new Date();
      const [hhStr, mmStr] = checkout_time.split(':');
      const hh = String(parseInt(hhStr, 10)).padStart(2, '0');
      const mm = String(parseInt(mmStr, 10)).padStart(2, '0');
      const y = baseDate.getFullYear();
      const m = String(baseDate.getMonth() + 1).padStart(2, '0');
      const d = String(baseDate.getDate()).padStart(2, '0');
      // Build an ISO string with +08:00 offset so Date parses it as the correct UTC instant
      const iso = `${y}-${m}-${d}T${hh}:${mm}:00+08:00`;
      checkOutAt = new Date(iso);
    } else if (typeof checkout_time === 'string') {
      const parsed = new Date(checkout_time);
      if (isNaN(parsed.getTime())) {
        throw new Error('Invalid checkout_time format');
      }
      checkOutAt = parsed;
    } else {
      checkOutAt = new Date();
    }

    const result = await eventRepository.massCheckOutStudents(
      event_id,
      student_ids,
      check_out_by,
      checkOutAt
    );

    // send emails for updated records
    for (const rec of result.updatedRecords) {
      try {
        const studentbyUserId = await studentRepository.getUserByStudentId(
          rec.student.student_id
        );
        const checkOutBy = rec.check_out_by_user?.id
          ? await studentRepository.getStudentByUserId(rec.check_out_by_user.id)
          : null;

        if (studentbyUserId && rec.check_out_at && checkOutBy) {
          await sendEmail(
            studentbyUserId.umindanao_email,
            'Event Check-Out Successful',
            CHECK_OUT_EMAIL.replace('{{name}}', rec.student.name)
              .replace('{{event_name}}', rec.event.title)
              .replace('{{event_location}}', rec.event.location)
              .replace(
                '{{event_date_and_time}}',
                rec.check_out_at.toLocaleString('en-US', {
                  timeZone: 'Asia/Manila',
                })
              )
              .replace('{{checked_out_by}}', checkOutBy.name)
          );
        }
      } catch (err) {
        console.warn(
          'Failed to send check-out email for student',
          rec.student.student_id,
          err
        );
      }
    }

    return result;
  } catch (error: unknown) {
    console.error(error);
    throw error;
  }
};

const scheduleEndEventStatusJob = async (event: events) => {
  if (!event.id) {
    return;
  }

  if (!event.all_day && !event.end_time) {
    console.warn(`Event ${event.id} has no end_time, skipping schedule.`);
    return;
  }

  const delay = event.all_day
    ? 24 * 60 * 60 * 1000
    : event.end_time
      ? Math.max(0, new Date(event.end_time).getTime() - Date.now())
      : 0;

  const jobId = `event-done-${event.id}`;

  await endEventStatusQueue.add(
    'mark-event-done',
    { event_id: event.id },
    { delay, jobId }
  );

  console.log(
    `Scheduled event ${event.id} to be marked done in ${delay / 1000}s`
  );
};

const scheduleStartEventStatusJob = async (event: events) => {
  if (!event.id) {
    return;
  }

  if (!event.all_day && !event.start_time) {
    console.warn(`Event ${event.id} has no start_time, skipping schedule.`);
    return;
  }

  const delay = event.all_day
    ? 0 // all-day events start immediately
    : event.start_time
      ? Math.max(0, new Date(event.start_time).getTime() - Date.now())
      : 0;

  const jobId = `event-start-${event.id}`;

  await startEventStatusQueue.add(
    'mark-event-started',
    { event_id: event.id },
    { delay, jobId }
  );

  console.log(
    `Scheduled event ${event.id} to be marked started in ${delay / 1000}s`
  );
};

const addOrganizer = async (
  umindanao_email: string,
  event_id: string,
  added_by: string
) => {
  const user = await authRepository.findUserByEmail(umindanao_email);
  if (!user) {
    throw new NotFoundError('User not found');
  }

  const user_id = user.id;

  if (!user_id) {
    throw new NotFoundError('User ID not found');
  }

  const existingOrganizer = await eventRepository.checkOrganizer(
    user_id,
    event_id
  );

  if (existingOrganizer) {
    throw new OrganizerError('User is already an organizer for this event');
  }

  try {
    const created = await eventRepository.addOrganizer(
      user_id,
      added_by,
      event_id
    );
    await invalidateOrganizerCache(user_id, event_id);
    return created;
  } catch (error) {
    // A concurrent request inserted the same organizer between our check and
    // this insert — treat the unique constraint violation as a duplicate error.
    if (
      error instanceof Prisma.PrismaClientKnownRequestError &&
      error.code === 'P2002'
    ) {
      throw new OrganizerError('User is already an organizer for this event');
    }
    throw error;
  }
};

const removeOrganizer = async (umindanao_email: string, event_id: string) => {
  const user = await authRepository.findUserByEmail(umindanao_email);
  if (!user) {
    throw new NotFoundError('User not found');
  }

  const user_id = user.id;

  if (!user_id) {
    throw new NotFoundError('User ID not found');
  }

  // Check if user is the event creator
  const event = await eventRepository.getEventDetails(event_id);
  if (event?.created_by === user_id) {
    throw new ForbiddenError('Cannot remove the event creator as an organizer');
  }

  const removed = await eventRepository.removeOrganizer(user_id, event_id);
  await invalidateOrganizerCache(user_id, event_id);
  return removed;
};

const getOrganizersByEventId = async (event_id: string) => {
  // Check if event exists
  const event = await eventRepository.getEventDetails(event_id);
  if (!event) {
    throw new NotFoundError('Event not found');
  }

  const organizers = await eventRepository.getOrganizersByEventId(event_id);

  if (organizers?.length === 0) {
    throw new NotFoundError('No organizers found for this event');
  }

  return organizers;
};

const getEventDetailsById = async (
  event_id: string,
  user_id: string,
  role?: string
): Promise<GetEventDetailsWithEditByIdInterface> => {
  const event = await eventRepository.getEventDetails(event_id);

  if (!event) {
    throw new NotFoundError('Event not found');
  }

  const checkin_count = await eventRepository.getEventCheckinCount(event_id);
  let checkout_count = 0;
  if (event.check_out_required) {
    checkout_count = await eventRepository.getEventCheckoutCount(event_id);
  }

  const student = await studentRepository.getStudentByUserId(user_id);
  if (!student) {
    throw new NotFoundError('Student not found');
  }

  const attendanceData = await eventRepository.checkIfUserAttended(
    event_id,
    student.student_id
  );
  const check_in_at = attendanceData?.check_in_at ?? null;
  const check_out_at =
    attendanceData?.check_out_at instanceof Date
      ? attendanceData.check_out_at
      : null;

  const is_organizer = await eventRepository.checkOrganizer(user_id, event_id);

  if (event.is_draft) {
    const canSeeDraft =
      role === 'admin' || role === 'csg' || !!is_organizer;
    if (!canSeeDraft) {
      throw new NotFoundError('Event not found');
    }
  }

  return {
    ...event,
    capacity: event.capacity ?? undefined,
    start_time: event.start_time ?? undefined,
    end_time: event.end_time ?? undefined,
    can_edit: !!is_organizer,
    checkin_count: checkin_count ?? 0,
    checkout_count,
    user_attendance: {
      check_in_at: check_in_at ?? null,
      check_out_at: check_out_at ?? null,
    },
  };
};

const getAllEvents = async (
  user_id: string,
  includeDrafts = false
): Promise<GetAllEventsInterface> => {
  const events = await eventRepository.getAllEvents(includeDrafts);

  if (events.length === 0) {
    return [] as GetAllEventsInterface;
  }

  return Promise.all(
    events.map(async (event) => {
      const is_organizer = await eventRepository.checkOrganizer(
        user_id,
        event.id
      );

      return {
        id: event.id,
        title: event.title,
        description: event.description,
        department: event.department,
        location: event.location,
        capacity: event.capacity ?? undefined,
        all_day: event.all_day,
        start_time: event.start_time ?? undefined,
        end_time: event.end_time ?? undefined,
        check_out_required: event.check_out_required,
        is_started: event.is_started,
        is_draft: event.is_draft,
        created_by: event.created_by,
        checkin_count: event.checkin_count ?? 0,
        checkout_count: event.checkout_count ?? 0,
        can_edit: !!is_organizer,
      };
    })
  );
};

const getAllPastEvents = async (
  user_id: string,
  includeDrafts = false
): Promise<GetAllEventsInterface> => {
  const events = await eventRepository.getAllPastEvents(includeDrafts);

  if (events.length === 0) {
    return [] as GetAllEventsInterface;
  }

  return Promise.all(
    events.map(async (event) => {
      const is_organizer = await eventRepository.checkOrganizer(
        user_id,
        event.id
      );

      return {
        id: event.id,
        title: event.title,
        description: event.description,
        department: event.department,
        location: event.location,
        capacity: event.capacity ?? undefined,
        all_day: event.all_day,
        start_time: event.start_time ?? undefined,
        end_time: event.end_time ?? undefined,
        check_out_required: event.check_out_required,
        is_done: event.is_done,
        is_draft: event.is_draft,
        created_by: event.created_by,
        checkin_count: event.checkin_count ?? 0,
        checkout_count: event.checkout_count ?? 0,
        can_edit: !!is_organizer,
      };
    })
  );
};

const getPaginatedAttendeesByEventId = async (
  event_id: string,
  page: number,
  limit: number,
  search?: string
): Promise<{
  data: GetStudentsByEventIdInterface[];
  pagination: {
    total: number;
    page: number;
    limit: number;
    totalPages: number;
  };
}> => {
  const { attendees, total } =
    await eventRepository.getPaginatedAttendeesByEventId(
      event_id,
      page,
      limit,
      search
    );

  if (total === 0) {
    throw new NotFoundError('No attendees found for this event');
  }

  const result = await Promise.all(
    attendees.map(async (attendee) => {
      const checkInBy = attendee.check_in_by_user?.id
        ? await studentRepository.getStudentByUserId(
            attendee.check_in_by_user.id
          )
        : null;

      const checkOutBy = attendee.check_out_by_user?.id
        ? await studentRepository.getStudentByUserId(
            attendee.check_out_by_user.id
          )
        : null;

      return {
        student: {
          id: attendee.student.id,
          user_id: attendee.student.user_id,
          student_id: attendee.student.student_id,
          name: attendee.student.name,
          umindanao_email: attendee.student.user?.umindanao_email,
          department: attendee.student.department,
          program: attendee.student.program,
          profile_picture: attendee.student.profile_picture,
          created_at: attendee.student.created_at,
          updated_at: attendee.student.updated_at,
          check_in_at: attendee.check_in_at,
          check_out_at: attendee.check_out_at,
          check_in_by: checkInBy?.name ?? null,
          check_out_by: checkOutBy?.name ?? null,
        },
      };
    })
  );

  return {
    data: result,
    pagination: {
      total,
      page,
      limit,
      totalPages: Math.ceil(total / limit),
    },
  };
};

const getAttendeesByEventId = async (
  event_id: string
): Promise<GetStudentsByEventIdInterface[]> => {
  const attendees = await eventRepository.getAttendeesByEventId(event_id);
  if (attendees.length === 0) {
    throw new NotFoundError('No attendees found for this event');
  }
  return Promise.all(
    attendees.map(async (attendee) => {
      const checkInBy = attendee.check_in_by_user?.id
        ? await studentRepository.getStudentByUserId(
            attendee.check_in_by_user.id
          )
        : null;
      const checkOutBy = attendee.check_out_by_user?.id
        ? await studentRepository.getStudentByUserId(
            attendee.check_out_by_user.id
          )
        : null;
      return {
        student: {
          id: attendee.student.id,
          user_id: attendee.student.user_id,
          student_id: attendee.student.student_id,
          name: attendee.student.name,
          umindanao_email: attendee.student.user?.umindanao_email,
          department: attendee.student.department,
          program: attendee.student.program,
          profile_picture: attendee.student.profile_picture,
          created_at: attendee.student.created_at,
          updated_at: attendee.student.updated_at,
          check_in_at: attendee.check_in_at,
          check_out_at: attendee.check_out_at,
          check_in_by: checkInBy?.name ?? null,
          check_out_by: checkOutBy?.name ?? null,
        },
      };
    })
  );
};

const getEventNameById = async (event_id: string): Promise<string> => {
  const eventData = await eventRepository.getEventDetails(event_id);

  if (!eventData) {
    throw new NotFoundError('No event found with this ID');
  }

  return eventData.title;
};

const getTotalAttendanceByEventId = async (
  event_id: string
): Promise<{ totalAttendance: number; totalCheckedOut: number }> => {
  return await eventRepository.getEventAttendanceCount(event_id);
};

/**
 * Manually check in a student to an event by their numeric student_id.
 * Used by organizers via the Attendance Records table action.
 */
const checkInStudentById = async (
  event_id: string,
  student_id: number,
  check_in_by: string
) => {
  try {
    if (!event_id) {
      throw new NotFoundError('Event ID is required');
    }

    const eventDetails = await eventRepository.getEventDetails(event_id);
    if (!eventDetails) {
      throw new NotFoundError('Event not found');
    }

    const checkedIn = await eventRepository.checkInStudentById(
      event_id,
      student_id,
      check_in_by
    );

    if (!checkedIn) {
      throw new Error('Failed to create check-in record');
    }

    const studentbyUserId =
      await studentRepository.getUserByStudentId(student_id);

    if (!studentbyUserId) {
      throw new NotFoundError('Student user not found');
    }

    const checkInByUser = checkedIn.check_in_by_user?.id
      ? await studentRepository.getStudentByUserId(
          checkedIn.check_in_by_user.id
        )
      : null;

    const checkInByName = checkInByUser
      ? checkInByUser.name
      : 'Organizer/Admin';

    try {
      await sendEmail(
        studentbyUserId?.umindanao_email,
        'Event Check-In Successful',
        CHECK_IN_EMAIL.replace('{{name}}', checkedIn.student.name)
          .replace('{{event_name}}', checkedIn.event.title)
          .replace('{{event_location}}', checkedIn.event.location)
          .replace(
            '{{event_date_and_time}}',
            checkedIn.check_in_at.toLocaleString('en-US', {
              timeZone: 'Asia/Manila',
            })
          )
          .replace('{{checked_in_by}}', checkInByName)
      );
    } catch (err) {
      console.warn(
        'Failed to send check-in email for student',
        student_id,
        err
      );
    }

    return checkedIn;
  } catch (error: unknown) {
    if (error instanceof AppError) {
      throw error;
    }
    console.error(error);
    throw error;
  }
};

/**
 * Manually check out a student from an event by their numeric student_id.
 * Used by organizers via the Attendance Records table action.
 */
const checkOutStudentById = async (
  event_id: string,
  student_id: number,
  check_out_by: string
) => {
  try {
    if (!event_id) {
      throw new NotFoundError('Event ID is required');
    }

    const eventDetails = await eventRepository.getEventDetails(event_id);
    if (!eventDetails) {
      throw new NotFoundError('Event not found');
    }
    if (!eventDetails.check_out_required) {
      throw new NoCheckoutRequiredError(
        'This event does not require check-out'
      );
    }

    const checkedOut = await eventRepository.checkOutStudentById(
      event_id,
      student_id,
      check_out_by
    );

    if (!checkedOut) {
      throw new Error('Failed to create check-out record');
    }

    if (!checkedOut.check_out_by_user) {
      throw new NotFoundError('Check-out record not found');
    }

    if (!checkedOut.check_out_at) {
      throw new NotFoundError('Check-out date not found');
    }

    const studentbyUserId =
      await studentRepository.getUserByStudentId(student_id);

    if (!studentbyUserId) {
      throw new NotFoundError('Student user not found');
    }

    const checkOutBy = await studentRepository.getStudentByUserId(
      checkedOut.check_out_by_user.id
    );

    const checkOutByName = checkOutBy ? checkOutBy.name : 'Organizer/Admin';

    try {
      await sendEmail(
        studentbyUserId?.umindanao_email,
        'Event Check-Out Successful',
        CHECK_OUT_EMAIL.replace('{{name}}', checkedOut.student.name)
          .replace('{{event_name}}', checkedOut.event.title)
          .replace('{{event_location}}', checkedOut.event.location)
          .replace(
            '{{event_date_and_time}}',
            checkedOut.check_out_at.toLocaleString('en-US', {
              timeZone: 'Asia/Manila',
            })
          )
          .replace('{{checked_out_by}}', checkOutByName)
      );
    } catch (err) {
      console.warn(
        'Failed to send check-out email for student',
        student_id,
        err
      );
    }

    return checkedOut;
  } catch (error: unknown) {
    if (error instanceof AppError) {
      throw error;
    }
    if (error instanceof Prisma.PrismaClientKnownRequestError) {
      if (error.code === 'P2002') {
        throw new Error('Unique constraint failed');
      }
      if (error.code === 'P2003') {
        throw new Error('Foreign key constraint failed');
      }
    }
    if (
      error instanceof Prisma.PrismaClientValidationError &&
      NODE_ENV === 'DEVELOPMENT'
    ) {
      throw new Error('Validation failed: ' + error.message);
    }
    console.error(error);
    throw error;
  }
};

const eventServices = {
  addEvent,
  deleteEvent,
  updateEvent,
  getAllEvents,
  createCheckInEvent,
  createCheckOutEvent,
  checkInStudentById,
  checkOutStudentById,
  massCheckOutStudents,
  addOrganizer,
  removeOrganizer,
  getOrganizersByEventId,
  getEventDetailsById,
  getAllPastEvents,
  getAttendeesByEventId,
  getEventNameById,
  getPaginatedAttendeesByEventId,
  getTotalAttendanceByEventId,
  postEvent,
  draftEvent,
};

export default eventServices;
