import { Request, Response, NextFunction } from "express";
import mongoose from "mongoose";
import { ZodError } from "zod";
import { MulterError } from "multer";
import { AppError, FieldError } from "../utils/AppError";
import { logger } from "../utils/logger";
import { MAX_FILE_SIZE_MB, MAX_FILES } from "../config/cloudinary";

export function notFound(req: Request, _res: Response, next: NextFunction) {
  next(new AppError(404, `We couldn't find ${req.method} ${req.originalUrl}.`, "ROUTE_NOT_FOUND"));
}

const FRIENDLY_FIELD: Record<string, string> = {
  email: "email address",
  slug: "name",
  orderNumber: "order number",
  name: "name",
};

/** Turn any thrown thing into a safe AppError with a human message. */
function normalize(err: any): AppError {
  if (err instanceof AppError) return err;

  // Request-body validation (zod)
  if (err instanceof ZodError) {
    const errors: FieldError[] = err.issues.map((i) => ({
      field: i.path.join(".") || "body",
      message: i.message,
    }));
    return AppError.validation(errors, errors[0]?.message || "Please check the highlighted fields.");
  }

  // Mongoose schema validation
  if (err instanceof mongoose.Error.ValidationError) {
    const errors = Object.values(err.errors).map((e: any) => ({ field: e.path, message: e.message }));
    return AppError.validation(errors, errors[0]?.message);
  }

  // Bad ObjectId etc. — "/products/abc" should be a 400/404, not a 500
  if (err instanceof mongoose.Error.CastError) {
    return AppError.badRequest(`"${err.value}" is not a valid ${err.path === "_id" ? "id" : err.path}.`);
  }

  // Unique index violation
  if (err?.code === 11000) {
    const field = Object.keys(err.keyValue || err.keyPattern || {})[0] || "value";
    const label = FRIENDLY_FIELD[field] || field;
    return AppError.conflict(`Something with this ${label} already exists.`);
  }

  // JWT
  if (err?.name === "TokenExpiredError") return AppError.unauthorized("Your session has expired. Please sign in again.");
  if (err?.name === "JsonWebTokenError") return AppError.unauthorized("Your session is invalid. Please sign in again.");

  // Uploads
  if (err instanceof MulterError) {
    const map: Record<string, string> = {
      LIMIT_FILE_SIZE: `Each file must be ${MAX_FILE_SIZE_MB}MB or smaller.`,
      LIMIT_FILE_COUNT: `You can upload up to ${MAX_FILES} files at a time.`,
      LIMIT_UNEXPECTED_FILE: `Too many files, or the upload field name is wrong (use "media").`,
    };
    return AppError.badRequest(map[err.code] || "There was a problem with the upload.");
  }

  // Malformed JSON body
  if (err?.type === "entity.parse.failed") return AppError.badRequest("The request body isn't valid JSON.");
  if (err?.type === "entity.too.large") return new AppError(413, "That request is too large.", "PAYLOAD_TOO_LARGE");

  // Legacy pattern: res.status(4xx); throw new Error("…")
  if (err?.statusCode && err.statusCode < 500) return new AppError(err.statusCode, err.message, "ERROR");

  const unknown = new AppError(500, "Something went wrong on our end. Please try again.", "INTERNAL_ERROR");
  (unknown as any).original = err;
  return unknown;
}

export function errorHandler(err: any, req: Request, res: Response, _next: NextFunction) {
  // Respect a 4xx status set by legacy controllers before throwing
  if (!(err instanceof AppError) && res.statusCode >= 400 && res.statusCode < 500 && !err?.statusCode) {
    err.statusCode = res.statusCode;
  }

  const appErr = normalize(err);
  const requestId = (req as any).id;

  if (appErr.status >= 500) {
    const original = (appErr as any).original || err;
    logger.error("Unhandled error", {
      requestId,
      method: req.method,
      path: req.originalUrl,
      error: original?.message,
      stack: original?.stack,
    });
  }

  res.status(appErr.status).json({
    success: false,
    message: appErr.message,
    code: appErr.code,
    ...(appErr.errors?.length ? { errors: appErr.errors } : {}),
    requestId,
    ...(process.env.NODE_ENV !== "production" && appErr.status >= 500
      ? { debug: (appErr as any).original?.message }
      : {}),
  });
}
