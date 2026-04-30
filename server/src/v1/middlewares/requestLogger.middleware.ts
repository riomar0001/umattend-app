import { logStructured } from '../../telemetry/logging';
import type { Request, Response, NextFunction } from 'express';

export function requestLogger(
  req: Request,
  res: Response,
  next: NextFunction
): void {
  const start = Date.now();

  res.on('finish', () => {
    const durationMs = Date.now() - start;
    logStructured(
      'http',
      res.statusCode >= 400 ? 'warn' : 'info',
      `HTTP REQUEST ${req.ip ?? ''} ${req.method} ${res.statusCode} ${req.originalUrl}`,
      {
        'http.method': req.method,
        'http.url': req.originalUrl,
        'http.status_code': res.statusCode,
        'http.duration_ms': durationMs,
        'http.user_agent': req.get('user-agent') ?? '',
        'http.ip': req.ip ?? '',
      }
    );
  });

  next();
}
