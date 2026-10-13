import { AsyncLocalStorage } from 'node:async_hooks';

export interface RequestMetrics {
  databaseReadOperations: number;
  databaseWriteOperations: number;
  databaseOperationMs: number;
  cacheHits: number;
  cacheMisses: number;
  cacheErrors: number;
}

export const requestMetrics = new AsyncLocalStorage<RequestMetrics>();

export const countCache = (outcome: 'hit' | 'miss' | 'error'): void => {
  const metrics = requestMetrics.getStore();
  if (!metrics) {
    return;
  }
  if (outcome === 'hit') {
    metrics.cacheHits++;
  } else if (outcome === 'miss') {
    metrics.cacheMisses++;
  } else {
    metrics.cacheErrors++;
  }
};
