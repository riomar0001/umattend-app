import type { RequestHandler } from 'express';
import { requestMetrics } from '../../utils/performance';

export const measureRequest: RequestHandler = (req, res, next) => {
  const started = performance.now();
  const metrics = {
    databaseReadOperations: 0,
    databaseWriteOperations: 0,
    databaseOperationMs: 0,
    cacheHits: 0,
    cacheMisses: 0,
    cacheErrors: 0,
  };
  res.once('finish', () => {
    // Express's matched template avoids recording tokens or personal IDs.
    const route = req.route?.path;
    console.log(
      JSON.stringify({
        event: 'api_performance',
        method: req.method,
        route: typeof route === 'string' ? req.baseUrl + route : 'unmatched',
        status: res.statusCode,
        durationMs: Math.round((performance.now() - started) * 100) / 100,
        ...metrics,
      })
    );
  });
  requestMetrics.run(metrics, next);
};
