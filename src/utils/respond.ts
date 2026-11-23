import { Response } from "express";

/**
 * Every successful response has the same shape so the frontends can show a
 * toast from `message` and read the payload from `data`:
 *   { success: true, message: "Product created.", data: {...} }
 */
export function ok<T>(res: Response, data: T, message = "OK", status = 200) {
  return res.status(status).json({ success: true, message, data });
}

export function created<T>(res: Response, data: T, message = "Created.") {
  return ok(res, data, message, 201);
}
