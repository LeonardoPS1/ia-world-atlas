export class HttpError extends Error {
  readonly status: number;
  readonly code: string;
  readonly details: unknown[];

  constructor(status: number, code: string, message: string, details: unknown[] = []) {
    super(message);
    this.name = 'HttpError';
    this.status = status;
    this.code = code;
    this.details = details;
  }

  static badRequest(details: unknown[] = []): HttpError {
    return new HttpError(400, 'VALIDATION_ERROR', 'Invalid request', details);
  }

  static notFound(message = 'Resource not found'): HttpError {
    return new HttpError(404, 'NOT_FOUND', message);
  }

  // No `methodNotAllowed` factory. Express 5 does not tell you which methods a
  // path supports, so producing a 405 would mean hand-maintaining a path registry
  // to mirror the routers. An unknown verb falls through to `notFoundHandler`
  // and answers 404, which is correct: from the client's point of view the
  // resource does not exist at that address. See Global Constraints.

  /**
   * 500 responses never carry the underlying message. Spec §11.6 requires that a
   * database message such as `relation "projects_type_check" violates check
   * constraint` or `ECONNREFUSED 127.0.0.1:5432` never reaches the client; the
   * `cause` is logged by the error handler, never serialised.
   */
  static internal(cause?: unknown): HttpError {
    void cause;
    return new HttpError(500, 'INTERNAL_ERROR', 'Unexpected server error', []);
  }
}
