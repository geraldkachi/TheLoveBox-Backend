import asyncHandler from "express-async-handler";
import { Request, Response } from "express";
import Discount from "../models/Discount";
import { AppError } from "../utils/AppError";
import { ok, created } from "../utils/respond";
import { discountLabel } from "../utils/pricing";

const publicView = (d: any) => ({
  code: d.code,
  type: d.type,
  value: d.value,
  label: discountLabel(d),
  headline: d.headline || `Enjoy ${discountLabel(d)} your first order`,
  description: d.description || "And be the first to hear about new boxes and seasonal drops.",
  minSubtotal: d.minSubtotal,
  firstOrderOnly: d.firstOrderOnly,
  endsAt: d.endsAt,
});

const isLive = (d: any) => {
  const now = new Date();
  return d.isActive && (!d.startsAt || d.startsAt <= now) && (!d.endsAt || d.endsAt >= now) && (d.maxUses == null || d.usedCount < d.maxUses);
};

/** GET /discounts/featured — the one discount the admin chose to show on the site (or null). */
export const featuredDiscount = asyncHandler(async (_req: Request, res: Response) => {
  const d = await Discount.findOne({ isVisible: true }).lean();
  res.setHeader("Cache-Control", "public, max-age=30");
  ok(res, d && isLive(d) ? publicView(d) : null);
});

export const getFeaturedForEmail = async () => {
  const d = await Discount.findOne({ isVisible: true }).lean();
  return d && isLive(d) ? publicView(d) : null;
};

export const listDiscounts = asyncHandler(async (_req: Request, res: Response) => {
  const items = await Discount.find().sort({ isVisible: -1, createdAt: -1 }).lean();
  ok(res, items.map((d) => ({ ...d, label: discountLabel(d), live: isLive(d) })));
});

async function onlyOneVisible(id: string, visible?: boolean) {
  if (visible) await Discount.updateMany({ _id: { $ne: id }, isVisible: true }, { $set: { isVisible: false } });
}

export const createDiscount = asyncHandler(async (req: Request, res: Response) => {
  if (req.body.type === "percent" && req.body.value > 100) throw AppError.badRequest("A percentage discount can't be more than 100%.");
  const d = await Discount.create(req.body);
  await onlyOneVisible(String(d._id), d.isVisible);
  created(res, d, `${d.code} created${d.isVisible ? " and now showing on the website" : ""}.`);
});

export const updateDiscount = asyncHandler(async (req: Request, res: Response) => {
  const d = await Discount.findById(req.params.id);
  if (!d) throw AppError.notFound("Discount");
  const wasVisible = d.isVisible;
  Object.assign(d, req.body);
  if (d.type === "percent" && d.value > 100) throw AppError.badRequest("A percentage discount can't be more than 100%.");
  await d.save();
  await onlyOneVisible(String(d._id), d.isVisible);

  let message = `${d.code} updated.`;
  if (req.body.isVisible === true && !wasVisible) message = `${d.code} is now showing on the website.`;
  else if (req.body.isVisible === false && wasVisible) message = `${d.code} is hidden from the website.`;
  else if (req.body.isActive === false) message = `${d.code} turned off — it can't be used at checkout.`;
  else if (req.body.isActive === true && Object.keys(req.body).length === 1) message = `${d.code} turned on.`;
  ok(res, d, message);
});

export const deleteDiscount = asyncHandler(async (req: Request, res: Response) => {
  const d = await Discount.findByIdAndDelete(req.params.id);
  if (!d) throw AppError.notFound("Discount");
  ok(res, { id: req.params.id }, `${d.code} deleted.`);
});
