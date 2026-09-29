import type { ErrorRequestHandler, RequestHandler } from 'express';
import type { Logger } from '../config/logger.ts';
import { HttpError } from './HttpError.ts';

export const notFoundHandler: RequestHandler = (req, _res, next) => {
  next(HttpError.notFound(`No route for ${req.method} ${req.path}`));
};

export function errorHandler(logger: Logger): ErrorRequestHandler {
  return (error, req, res, _next) => {
    const requestId = String((req as { id?: string }).id ?? 'unknown');

    // express.json() raises a plain error carrying a status; normalise it so every
    // failure leaves the API through the same envelope.
    const rawStatus =
      (error as { status?: number }).status ?? (error as { statusCode?: number }).statusCode;
    if (rawStatus === 413) {
      res.status(413).json({
        error: {
          code: 'PAYLOAD_TOO_LARGE',
          message: 'Request body exceeds the 1mb limit',
          details: [],
          requestId,
        },
      });
      return;
    }

    const isHttp = error instanceof HttpError;
    const status = isHttp ? error.status : 500;
    const code = isHttp ? error.code : 'INTERNAL_ERROR';
    const message = isHttp ? error.message : 'Unexpected server error';
    const details = isHttp ? error.details : [];

    if (!isHttp) {
      logger.error('unhandled error', {
        requestId,
        message: (error as Error).message,
        stack: (error as Error).stack,
      });
    }

    res.status(status).json({
      error: { code, message, details, requestId },
    });
  };
}
