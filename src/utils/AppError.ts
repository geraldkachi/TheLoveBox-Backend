/**
 * A predictable, user-safe error. Anything thrown as an AppError is sent to
 * the client as-is (status, code, message, field errors). Anything else is
 * treated as an unexpected failure and its details are hidden in production.
 */
export type FieldError = { field: string; message: string };

export class AppError extends Error {
  status: number;
  code: string;
  errors?: FieldError[];
  isOperational = true;

  constructor(status: number, message: string, code = "ERROR", errors?: FieldError[]) {
    super(message);
    this.status = status;
    this.code = code;
    this.errors = errors;
    Object.setPrototypeOf(this, AppError.prototype);
  }

  static badRequest(message = "Some details are missing or invalid.", errors?: FieldError[]) {
    return new AppError(400, message, "BAD_REQUEST", errors);
  }
  static validation(errors: FieldError[], message = "Please check the highlighted fields.") {
    return new AppError(422, message, "VALIDATION_ERROR", errors);
  }
  static unauthorized(message = "Please sign in to continue.") {
    return new AppError(401, message, "UNAUTHORIZED");
  }
  static forbidden(message = "You don't have permission to do this.") {
    return new AppError(403, message, "FORBIDDEN");
  }
  static notFound(what = "Resource") {
    return new AppError(404, `${what} not found.`, "NOT_FOUND");
  }
  static conflict(message: string) {
    return new AppError(409, message, "CONFLICT");
  }
  static upstream(message = "Our payment partner is unreachable right now. Please try again shortly.") {
    return new AppError(502, message, "UPSTREAM_ERROR");
  }
}
