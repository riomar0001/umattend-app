import prisma from '../../configs/prisma.config';

const findUserById = async (user_id: string) => {
  return await prisma.user.findUnique({
    where: { id: user_id },
    include: {
      student: true,
    },
  });
};

const onboardUser = async (
  user_id: string,
  department: string,
  program: string,
  // Only set when the account has no ID number yet — the service leaves this
  // undefined otherwise, so an existing student_id is never overwritten.
  student_id?: number
) => {
  const user = await prisma.user.update({
    where: { id: user_id },
    data: {
      done_onboarding: true,
      student: {
        update: {
          department,
          program,
          ...(student_id === undefined ? {} : { student_id }),
        },
      },
    },
    select: {
      id: true,
      done_onboarding: true,
      umindanao_email: true,
      role: true,
      student: true,
    },
  });

  if (!user) {
    return null;
  }

  return user;
};

const getUserAttendedEvents = async (student_id: number) => {
  const attendedEvents = await prisma.attendance.findMany({
    where: {
      student_id: student_id,
    },
    select: {
      event: {
        select: {
          id: true,
          title: true,
          start_time: true,
          end_time: true,
        },
      },
    },
    orderBy: {
      event: {
        start_time: 'desc',
      },
    },
  });

  return attendedEvents.map((record) => ({
    ...record.event,
  }));
};

const getUserAttendedEventsDetailed = async (student_id: number) => {
  // First get the student_id for this user
  const student = await prisma.student.findUnique({
    where: { student_id },
    select: { id: true },
  });

  if (!student) {
    return [];
  }

  const attendedEvents = await prisma.attendance.findMany({
    where: {
      student_id,
    },
    select: {
      event: {
        select: {
          id: true,
          title: true,
          start_time: true,
          end_time: true,
          check_out_required: true,
          created_by: true,
          user: {
            select: {
              student: {
                select: {
                  name: true,
                },
              },
            },
          },
        },
      },
    },
    orderBy: {
      event: {
        start_time: 'desc',
      },
    },
  });

  return attendedEvents.map((record) => ({
    id: record.event.id,
    title: record.event.title,
    created_by: record.event.user.student?.name ?? 'Unknown',
    start_time: record.event.start_time,
    end_time: record.event.end_time,
  }));
};

const getUserHostedEvents = async (user_id: string) => {
  const hostedEvents = await prisma.events.findMany({
    where: {
      created_by: user_id,
    },
    select: {
      id: true,
      title: true,
      start_time: true,
      end_time: true,
      check_out_required: true,
      created_by: true,
      user: {
        select: {
          student: {
            select: {
              name: true,
            },
          },
        },
      },
      _count: {
        select: { attendance: true },
      },
    },
    orderBy: {
      start_time: 'desc',
    },
  });

  const eventIds = hostedEvents.map((e) => e.id);
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

  return hostedEvents.map((event) => {
    const checkin_count = event._count.attendance;
    const checkout_count = checkoutMap.get(event.id) ?? 0;
    return {
      id: event.id,
      title: event.title,
      created_by: event.user.student?.name ?? 'Unknown',
      start_time: event.start_time,
      end_time: event.end_time,
      attendees: event.check_out_required ? checkout_count : checkin_count,
    };
  });
};

const updateUserProfile = async (
  user_id: string,
  department?: string,
  program?: string,
  // Undefined leaves the stored ID alone; the service validates any value that
  // reaches here, and the unique index rejects one already in use.
  student_id?: number
) => {
  // Update student record for this user. Use updateMany to be safe if student row exists.
  const user = await prisma.user.update({
    where: { id: user_id },
    data: {
      student: {
        update: {
          ...(department !== undefined ? { department } : {}),
          ...(program !== undefined ? { program } : {}),
          ...(student_id !== undefined ? { student_id } : {}),
        },
      },
    },
    include: {
      student: true,
    },
  });

  return user;
};

const userRepository = {
  findUserById,
  onboardUser,
  updateUserProfile,
  getUserAttendedEvents,
  getUserAttendedEventsDetailed,
  getUserHostedEvents,
};

export default userRepository;
