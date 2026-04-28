import prisma from '../../configs/prisma.config';
import { Prisma } from '@prisma/client';

const findAllUsers = async (page: number, limit: number, search?: string) => {
  const skip = (page - 1) * limit;

  const where: Prisma.userWhereInput = {
    deleted_at: null,
  };

  if (search) {
    const orConditions: Prisma.userWhereInput[] = [
      { umindanao_email: { contains: search, mode: 'insensitive' } },
    ];

    orConditions.push({
      student: { name: { contains: search, mode: 'insensitive' } },
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
      { title: { contains: search, mode: 'insensitive' } },
      { description: { contains: search, mode: 'insensitive' } },
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

const adminRepository = {
  findAllUsers,
  findUserById,
  updateUserRole,
  softDeleteUser,
  findAllEvents,
};

export default adminRepository;
