import { PrismaClient } from '@prisma/client';
import { trace } from '@opentelemetry/api';
import { logStructured } from '../telemetry/logging';

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

  // Default to 30s but let callers override (e.g. batched bulk operations).
  const mergedOptions: TransactionOptions = {
    timeout: 30000,
    ...(options ?? {}),
  } as TransactionOptions;

  return originalTransaction(queries, mergedOptions)
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
  const level = e.duration > 10000 ? 'warn' : e.duration > 1000 ? 'warn' : 'info';
  logStructured('prisma', level, '', {
    'db.query': e.query,
    'db.params': JSON.stringify(e.params),
    'db.duration_ms': e.duration,
  });

  if (e.duration > 10000) {
    console.warn(`SLOW QUERY: ${e.duration}ms`, {
      timestamp: new Date().toISOString(),
      query: e.query,
      params: e.params,
      duration: e.duration,
    });
  }
});

const tracer = trace.getTracer('prisma');

const prismaWithTracing = prisma.$extends({
  query: {
    $allModels: {
      $allOperations: async ({ model, operation, args, query }) => {
        const startTime = Date.now();
        return tracer.startActiveSpan(
          `prisma.${model}.${operation}`,
          async (span) => {
            try {
              const result = await query(args);
              const durationMs = Date.now() - startTime;
              span.setAttribute('db.model', model);
              span.setAttribute('db.operation', operation);
              span.setAttribute('db.duration_ms', durationMs);
              span.end();
              return result;
            } catch (e) {
              span.recordException(e as Error);
              span.end();
              throw e;
            }
          }
        );
      },
    },
  },
});

export default prismaWithTracing;
