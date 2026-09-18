import prisma from '../../configs/prisma.config';
import { Prisma } from '@/generated/prisma/client';
import { queryInBatches } from '@/utils/d1';

const findAllUsers = async (page: number, limit: number, search?: string) => {
  const skip = (page - 1) * limit;

  const where: Prisma.userWhereInput = {
    deleted_at: null,
  };

  if (search) {
    // No `mode: 'insensitive'` — that filter is Postgres-only and the SQLite
    // client rejects it. SQLite's LIKE is already case-insensitive for ASCII,
    // so `contains` behaves the same for names and emails.
    const orConditions: Prisma.userWhereInput[] = [
      { umindanao_email: { contains: search } },
    ];

    orConditions.push({
      student: { name: { contains: search } },
    });

    const parsedId = Number(search);
    if (!Number.isNaN(parsedId) && Number.isFinite(parsedId)) {
      orConditions.push({
        student: { student_id: { equals: parsedId } },
      });
    }

    where.OR = orConditions;
  }

  const [users, total] = await Promise.all([
    prisma.user.findMany({
      where,
      select: {
        id: true,
        umindanao_email: true,
        role: true,
        done_onboarding: true,
        last_login_at: true,
        created_at: true,
        updated_at: true,
        student: {
          select: {
            student_id: true,
            name: true,
            department: true,
            program: true,
          },
        },
      },
      orderBy: { created_at: 'desc' },
      skip,
      take: limit,
    }),
    prisma.user.count({ where }),
  ]);

  return { users, total };
};

const findUserById = async (userId: string) => {
  return await prisma.user.findFirst({
    where: { id: userId, deleted_at: null },
    include: {
      student: {
        select: {
          student_id: true,
          name: true,
          department: true,
          program: true,
          profile_picture: true,
        },
      },
    },
  });
};

const updateUserRole = async (userId: string, role: string) => {
  return await prisma.user.update({
    where: { id: userId },
    data: { role },
    select: {
      id: true,
      umindanao_email: true,
      role: true,
      done_onboarding: true,
      last_login_at: true,
      created_at: true,
      updated_at: true,
      student: {
        select: {
          student_id: true,
          name: true,
          department: true,
          program: true,
        },
      },
    },
  });
};

const softDeleteUser = async (userId: string) => {
  return await prisma.user.update({
    where: { id: userId },
    data: { deleted_at: new Date() },
  });
};

const findAllEvents = async (
  page: number,
  limit: number,
  search?: string,
  includeDrafts = true
) => {
  const skip = (page - 1) * limit;

  const where: Prisma.eventsWhereInput = {
    ...(includeDrafts ? {} : { is_draft: false }),
  };

  if (search) {
    where.OR = [
      { title: { contains: search } },
      { description: { contains: search } },
    ];
  }

  const [events, total] = await Promise.all([
    prisma.events.findMany({
      where,
      include: {
        _count: { select: { attendance: true } },
        user: {
          select: {
            student: { select: { name: true } },
          },
        },
      },
      orderBy: { start_time: 'desc' },
      skip,
      take: limit,
    }),
    prisma.events.count({ where }),
  ]);

  // Batched: `limit` reaches here straight from the query string, so this
  // filter can carry more ids than D1 allows bound parameters. See utils/d1.
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

  const data = events.map((event) => {
    const { _count, ...rest } = event;
    return {
      ...rest,
      created_by_name: event.user.student?.name ?? 'Unknown',
      user: undefined,
      checkin_count: _count.attendance,
      checkout_count: checkoutMap.get(event.id) ?? 0,
    };
  });

  return { data, total };
};

// ---------------------------------------------------------------------------
// Statistics
// ---------------------------------------------------------------------------

const DAY_MS = 24 * 60 * 60 * 1000;

/**
 * Dashboard aggregates for users and events.
 *
 * Every figure is a `count` or `groupBy` executed by SQLite rather than rows
 * pulled into the Worker and counted in JS — the tables grow without bound and
 * D1 charges by rows read. The queries are independent, so they are issued
 * together; D1 has no transactions, and these are reads, so there is nothing to
 * make atomic. The slight skew between counts taken microseconds apart does not
 * matter for a dashboard.
 *
 * Soft-deleted users are excluded everywhere except `deleted`, which reports
 * them explicitly.
 */
const getStatistics = async () => {
  const now = Date.now();
  const last7 = new Date(now - 7 * DAY_MS);
  const last30 = new Date(now - 30 * DAY_MS);

  const live = { deleted_at: null };

  const [
    usersTotal,
    usersDeleted,
    usersOnboarded,
    usersNew30,
    usersActive7,
    usersByRole,
    studentsWithId,
    eventsTotal,
    eventsDraft,
    eventsOngoing,
    eventsDone,
    eventsNew30,
    eventsByDepartment,
    attendanceTotal,
    attendanceCheckedOut,
    attendance7,
  ] = await Promise.all([
    prisma.user.count({ where: live }),
    prisma.user.count({ where: { NOT: { deleted_at: null } } }),
    prisma.user.count({ where: { ...live, done_onboarding: true } }),
    prisma.user.count({ where: { ...live, created_at: { gte: last30 } } }),
    prisma.user.count({ where: { ...live, last_login_at: { gte: last7 } } }),
    prisma.user.groupBy({
      by: ['role'],
      where: live,
      _count: { _all: true },
    }),
    // Attendance requires a student_id; accounts without one cannot be scanned.
    prisma.student.count({ where: { NOT: { student_id: null } } }),

    prisma.events.count(),
    prisma.events.count({ where: { is_draft: true } }),
    prisma.events.count({
      where: { is_draft: false, is_started: true, is_done: false },
    }),
    prisma.events.count({ where: { is_draft: false, is_done: true } }),
    prisma.events.count({ where: { created_at: { gte: last30 } } }),
    prisma.events.groupBy({
      by: ['department'],
      _count: { _all: true },
    }),

    prisma.attendance.count(),
    prisma.attendance.count({ where: { NOT: { check_out_at: null } } }),
    prisma.attendance.count({ where: { check_in_at: { gte: last7 } } }),
  ]);

  const published = eventsTotal - eventsDraft;
  // Anything published that has neither started nor finished is still to come.
  const eventsUpcoming = published - eventsOngoing - eventsDone;

  const toBreakdown = (
    rows: { _count: { _all: number } }[],
    key: string
  ): { label: string; count: number }[] =>
    rows
      .map((row) => ({
        label: String((row as unknown as Record<string, unknown>)[key] ?? '—'),
        count: row._count._all,
      }))
      .sort((a, b) => b.count - a.count);

  return {
    users: {
      total: usersTotal,
      deleted: usersDeleted,
      onboarded: usersOnboarded,
      pendingOnboarding: usersTotal - usersOnboarded,
      newLast30Days: usersNew30,
      activeLast7Days: usersActive7,
      scannableStudents: studentsWithId,
      byRole: toBreakdown(usersByRole, 'role'),
    },
    events: {
      total: eventsTotal,
      draft: eventsDraft,
      published,
      upcoming: Math.max(0, eventsUpcoming),
      ongoing: eventsOngoing,
      done: eventsDone,
      newLast30Days: eventsNew30,
      byDepartment: toBreakdown(eventsByDepartment, 'department').slice(0, 8),
    },
    attendance: {
      total: attendanceTotal,
      checkedOut: attendanceCheckedOut,
      stillCheckedIn: attendanceTotal - attendanceCheckedOut,
      last7Days: attendance7,
      // Only meaningful against events that actually ran.
      averagePerRunEvent:
        eventsOngoing + eventsDone > 0
          ? Math.round((attendanceTotal / (eventsOngoing + eventsDone)) * 10) / 10
          : 0,
    },
  };
};

const adminRepository = {
  findAllUsers,
  findUserById,
  updateUserRole,
  softDeleteUser,
  findAllEvents,
  getStatistics,
};

export default adminRepository;
