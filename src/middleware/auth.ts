import { Request, Response, NextFunction } from "express";
import jwt from "jsonwebtoken";
import User from "../models/User";
import { AppError } from "../utils/AppError";

export interface AuthRequest extends Request {
  user?: { id: string; role: string; email?: string; name?: string };
}

/** Require a valid Bearer token and an account that still exists. */
export async function protect(req: AuthRequest, _res: Response, next: NextFunction) {
  try {
    const header = req.headers.authorization;
    if (!header?.startsWith("Bearer ")) throw AppError.unauthorized("Please sign in to continue.");

    const token = header.slice(7).trim();
    const decoded = jwt.verify(token, process.env.JWT_SECRET as string) as { id: string; role: string };

    const user = await User.findById(decoded.id).select("role email name").lean();
    if (!user) throw AppError.unauthorized("This account no longer exists. Please sign in again.");

    req.user = { id: String(user._id), role: user.role, email: user.email, name: user.name };
    next();
  } catch (err) {
    next(err); // JWT errors are translated by the central error handler
  }
}

export function requireRole(...roles: string[]) {
  return (req: AuthRequest, _res: Response, next: NextFunction) => {
    if (!req.user) return next(AppError.unauthorized());
    if (!roles.includes(req.user.role)) return next(AppError.forbidden());
    next();
  };
}

/** Attach the user if a valid token is present, but never block the request. */
export async function optionalAuth(req: AuthRequest, _res: Response, next: NextFunction) {
  const header = req.headers.authorization;
  if (!header?.startsWith("Bearer ")) return next();
  try {
    const decoded = jwt.verify(header.slice(7).trim(), process.env.JWT_SECRET as string) as { id: string; role: string };
    const user = await User.findById(decoded.id).select("role email name").lean();
    if (user) req.user = { id: String(user._id), role: user.role, email: user.email, name: user.name };
  } catch {
    /* ignore — guest checkout */
  }
  next();
}
