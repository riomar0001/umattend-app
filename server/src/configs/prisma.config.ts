import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

type TransactionOptions = Parameters<typeof prisma.$transaction>[1];

const originalTransaction = prisma.$transaction.bind(
  prisma
) as typeof prisma.$transaction;

// eslint-disable-next-line @typescript-eslint/no-explicit-any
(prisma.$transaction as any) = function <T>(
  queries: Parameters<typeof prisma.$transaction>[0],
  options?: TransactionOptions
): Promise<T> {
  const startTime = Date.now();

  return originalTransaction(queries, {
    ...options,
    timeout: 30000,
  } as TransactionOptions)
    .then((result: unknown) => {
      const duration = Date.now() - startTime;
      if (duration > 10000) {
        console.warn(`SLOW TRANSACTION: ${duration}ms`, {
          timestamp: new Date().toISOString(),
          duration,
          action: 'transaction',
        });
      }
      return result as T;
    })
    .catch((error: Error & { code?: string }) => {
      const duration = Date.now() - startTime;
      console.error(`TRANSACTION FAILED: ${duration}ms`, {
        timestamp: new Date().toISOString(),
        duration,
        error: error.message,
        code: error.code,
      });
      throw error;
    });
};

// eslint-disable-next-line @typescript-eslint/no-explicit-any
(prisma as any).$on('query', (e: any) => {
  if (e.duration > 10000) {
    console.warn(`SLOW QUERY: ${e.duration}ms`, {
      timestamp: new Date().toISOString(),
      query: e.query,
      params: e.params,
      duration: e.duration,
    });
  }
});

export default prisma;
