import asyncHandler from "express-async-handler";
import { Request, Response } from "express";
import User from "../models/User";
import { generateToken } from "../utils/generateToken";

const ALLOWED_SELF_SIGNUP_ROLES = ["customer", "vendor"];

export const register = asyncHandler(async (req: Request, res: Response) => {
  const { name, email, password, role } = req.body;

  if (!name || !email || !password) {
    res.status(400);
    throw new Error("Name, email, and password are all required.");
  }
  if (password.length < 6) {
    res.status(400);
    throw new Error("Password must be at least 6 characters.");
  }

  const exists = await User.findOne({ email: email.toLowerCase() });
  if (exists) {
    res.status(400);
    throw new Error("An account with this email already exists. Try signing in instead.");
  }

  let safeRole = ALLOWED_SELF_SIGNUP_ROLES.includes(role) ? role : "customer";
  if (role === "admin") {
    const adminExists = await User.exists({ role: "admin" });
    safeRole = adminExists ? "vendor" : "admin";
  }
  const user = await User.create({ name, email: email.toLowerCase(), password, role: safeRole });

  res.status(201).json({
    id: user._id,
    name: user.name,
    email: user.email,
    role: user.role,
    token: generateToken(user._id.toString(), user.role),
  });
});

export const login = asyncHandler(async (req: Request, res: Response) => {
  const { email, password } = req.body;
  const user = await User.findOne({ email: email?.toLowerCase() }).select("+password");
  if (!user || !(await user.comparePassword(password))) {
    res.status(401);
    throw new Error("Incorrect email or password.");
  }
  res.json({
    id: user._id,
    name: user.name,
    email: user.email,
    role: user.role,
    token: generateToken(user._id.toString(), user.role),
  });
});

export const getMe = asyncHandler(async (req: Request, res: Response) => {
  const authReq = req as any;
  const user = await User.findById(authReq.user.id);
  if (!user) {
    res.status(404);
    throw new Error("Account not found.");
  }
  res.json({ id: user._id, name: user.name, email: user.email, role: user.role });
});
