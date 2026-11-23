import asyncHandler from "express-async-handler";
import { Request, Response } from "express";
import Inquiry from "../models/Inquiry";
import Subscriber from "../models/Subscriber";
import { ok, created } from "../utils/respond";
import { sendMailLater } from "../emails/mailer";
import { contactAckEmail, adminContactEmail, welcomeEmail } from "../emails/templates";
import { getFeaturedForEmail } from "./discountController";

export const submitInquiry = asyncHandler(async (req: Request, res: Response) => {
  const inquiry = await Inquiry.create(req.body);
  sendMailLater({ to: inquiry.email, ...contactAckEmail(inquiry.name) });
  const admins = (process.env.ADMIN_NOTIFY_EMAIL || "").split(",").map((s) => s.trim()).filter(Boolean);
  if (admins.length) sendMailLater({ to: admins, replyTo: inquiry.email, ...adminContactEmail(inquiry) });
  created(res, { id: inquiry._id }, `Thanks ${inquiry.name.split(" ")[0]} — we'll get back to you within the hour.`);
});

export const listInquiries = asyncHandler(async (_req: Request, res: Response) => {
  ok(res, await Inquiry.find().sort({ createdAt: -1 }).limit(100).lean());
});

export const subscribe = asyncHandler(async (req: Request, res: Response) => {
  const discount = await getFeaturedForEmail();
  const existing = await Subscriber.findOne({ email: req.body.email });
  if (!existing) {
    await Subscriber.create({ email: req.body.email });
    sendMailLater({ to: req.body.email, ...welcomeEmail(discount) });
  }
  // The popup reveals the code straight away; the email is a copy for later.
  ok(
    res,
    { discount: discount ? { code: discount.code, label: discount.label } : null },
    existing ? "You're already on the list — thank you!" : discount ? `Your code ${discount.code} is on its way to your inbox.` : "You're on the list! Look out for gifting ideas in your inbox.",
    existing ? 200 : 201
  );
});
