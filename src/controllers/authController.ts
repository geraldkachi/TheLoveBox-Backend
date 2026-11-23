import asyncHandler from "express-async-handler";
import { Request, Response } from "express";
import User from "../models/User";
import { generateToken } from "../utils/generateToken";
import { AppError } from "../utils/AppError";
import { ok, created } from "../utils/respond";
import { AuthRequest } from "../middleware/auth";

const ALLOWED_SELF_SIGNUP_ROLES = ["customer", "vendor"];

const publicUser = (u: any) => ({ id: u._id, name: u.name, email: u.email, role: u.role });

export const register = asyncHandler(async (req: Request, res: Response) => {
  const { name, email, password, role } = req.body;

  const exists = await User.exists({ email });
  if (exists) throw AppError.conflict("An account with this email already exists. Try signing in instead.");

  // Only the very first "admin" signup becomes an admin; later ones become vendors.
  let safeRole = ALLOWED_SELF_SIGNUP_ROLES.includes(role) ? role : "customer";
  if (role === "admin") {
    const adminExists = await User.exists({ role: "admin" });
    safeRole = adminExists ? "vendor" : "admin";
  }

  const user = await User.create({ name, email, password, role: safeRole });
  created(
    res,
    { ...publicUser(user), token: generateToken(user._id.toString(), user.role) },
    `Welcome to The Love Box, ${user.name.split(" ")[0]}!`
  );
});

export const login = asyncHandler(async (req: Request, res: Response) => {
  const { email, password } = req.body;
  const user = await User.findOne({ email }).select("+password");
  if (!user || !(await user.comparePassword(password))) {
    throw AppError.unauthorized("Incorrect email or password.");
  }
  ok(res, { ...publicUser(user), token: generateToken(user._id.toString(), user.role) }, `Welcome back, ${user.name.split(" ")[0]}.`);
});

export const getMe = asyncHandler(async (req: AuthRequest, res: Response) => {
  const user = await User.findById(req.user!.id);
  if (!user) throw AppError.notFound("Account");
  ok(res, publicUser(user));
});

export const logout = asyncHandler(async (_req: Request, res: Response) => {
  ok(res, null, "You've been signed out.");
});
