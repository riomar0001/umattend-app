import { Request, Response } from 'express';
import prisma from '../../configs/prisma.config';

export const getHealth = async (_req: Request, res: Response) => {
  res.status(200).json({ status: 'ok' });
};

export const getHealthDetailed = async (_req: Request, res: Response) => {
  const healthCheck = {
    status: 'ok',
    uptime: process.uptime(),
    memory: {
      total: Math.round(process.memoryUsage().heapTotal / 1024 / 1024) + ' MB',
      used: Math.round(process.memoryUsage().heapUsed / 1024 / 1024) + ' MB',
    },
    database: {
      status: 'unknown',
      responseTime: 0,
    },
  };

  try {
    const start = Date.now();
    await prisma.$queryRaw`SELECT 1`;
    healthCheck.database.status = 'connected';
    healthCheck.database.responseTime = Date.now() - start;
  } catch (error) {
    healthCheck.status = 'degraded';
    healthCheck.database.status = 'disconnected';
    console.error('Database health check failed:', error);
  }

  const statusCode = healthCheck.status === 'ok' ? 200 : 503;
  res.status(statusCode).json(healthCheck);
};
