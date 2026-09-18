import { Request, Response, NextFunction } from 'express';
import { CustomError } from '@/v1/interface/error';
import { NODE_ENV } from '../../constants/app.constants';

/**
 * Terminal error handler.
 *
 * The fourth parameter is load-bearing even though it is unused: Express
 * recognises error-handling middleware purely by arity (`fn.length === 4`).
 * Declared with three, this was registered as ordinary middleware and skipped
 * entirely on the error path — every 404, CORS rejection, malformed JSON body
 * and rejected handler promise fell through to Express's built-in
 * `finalhandler`, which answers with an HTML page carrying the stack trace and
 * absolute source paths rather than this JSON shape.
 *
 * Do not remove `_next`, and do not let a linter "unused parameter" rule strip
 * it; there is no runtime signal that it is gone.
 */
export const errorHandler = (
  err: CustomError,
  req: Request,
  res: Response,
  _next: NextFunction
) => {
  const statusCode =
    err.statusCode ?? (res.statusCode >= 400 ? res.statusCode : 500);

  // Once the response has started there is no way to replace it with JSON;
  // handing back to Express lets it abort the connection instead of throwing
  // ERR_HTTP_HEADERS_SENT out of this handler.
  if (res.headersSent) {
    return _next(err);
  }

  const isDevelopment = NODE_ENV === 'DEVELOPMENT';

  // 4xx messages describe what the caller did wrong and are safe to return —
  // "Not Found - /api/v1/nope", "Forbidden", a JSON parse position. Masking
  // those too would leave the frontend unable to tell a missing event from a
  // broken server. 5xx messages come from unhandled internals, so only their
  // status survives outside development.
  const isClientError = statusCode >= 400 && statusCode < 500;

  const response = {
    success: false,
    message:
      isDevelopment || isClientError
        ? err.message
        : 'Something went wrong. Please try again later.',
    ...(isDevelopment && {
      stack: err.stack,
    }),
  };

  return res.status(statusCode).json(response);
};

export const notFound = (req: Request, res: Response, next: NextFunction) => {
  const error = new Error(`Not Found - ${req.originalUrl}`) as CustomError;
  error.statusCode = 404;
  next(error);
};
