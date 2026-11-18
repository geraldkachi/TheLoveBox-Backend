import { Request, Response, NextFunction } from "express";
import crypto from "crypto";
import { logger } from "../utils/logger";

/** Attach a request id (echoed in errors) and log slow / failed requests. */
export function requestId(req: Request, res: Response, next: NextFunction) {
  const id = (req.headers["x-request-id"] as string) || crypto.randomUUID();
  (req as any).id = id;
  res.setHeader("X-Request-Id", id);

  const start = Date.now();
  res.on("finish", () => {
    const ms = Date.now() - start;
    if (res.statusCode >= 500 || ms > 2000) {
      logger.warn("Request", { id, method: req.method, path: req.originalUrl, status: res.statusCode, ms });
    }
  });
  next();
}
