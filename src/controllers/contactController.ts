import asyncHandler from "express-async-handler";
import { Request, Response } from "express";
import Inquiry from "../models/Inquiry";
import Subscriber from "../models/Subscriber";
import { ok, created } from "../utils/respond";

export const submitInquiry = asyncHandler(async (req: Request, res: Response) => {
  const inquiry = await Inquiry.create(req.body);
  created(res, { id: inquiry._id }, `Thanks ${inquiry.name.split(" ")[0]} — we'll get back to you within the hour.`);
});

export const listInquiries = asyncHandler(async (_req: Request, res: Response) => {
  ok(res, await Inquiry.find().sort({ createdAt: -1 }).limit(100).lean());
});

export const subscribe = asyncHandler(async (req: Request, res: Response) => {
  const existing = await Subscriber.findOne({ email: req.body.email });
  if (existing) return void ok(res, null, "You're already on the list — thank you!");
  await Subscriber.create({ email: req.body.email });
  created(res, null, "You're on the list! Look out for gifting ideas in your inbox.");
});
