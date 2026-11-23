import { Request, Response, NextFunction } from "express";
import { ZodTypeAny } from "zod";
import mongoose from "mongoose";
import { AppError } from "../utils/AppError";

type Part = "body" | "query" | "params";

/** Validate (and coerce/strip) a part of the request with a zod schema. */
export const validate =
  (schema: ZodTypeAny, part: Part = "body") =>
  (req: Request, _res: Response, next: NextFunction) => {
    const result = schema.safeParse(req[part]);
    if (!result.success) return next(result.error);
    // query is a getter in Express 5; assigning is fine in Express 4
    (req as any)[part] = result.data;
    next();
  };

/** Reject malformed :id params before they hit the database. */
export const validObjectId =
  (param = "id", label = "item") =>
  (req: Request, _res: Response, next: NextFunction) => {
    if (!mongoose.isValidObjectId(req.params[param])) {
      return next(AppError.badRequest(`That ${label} id isn't valid.`));
    }
    next();
  };
