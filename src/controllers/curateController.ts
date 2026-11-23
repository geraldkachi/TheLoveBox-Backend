import asyncHandler from "express-async-handler";
import { Request, Response } from "express";
import CurateOption from "../models/CurateOption";
import { AppError } from "../utils/AppError";
import { ok, created } from "../utils/respond";
import { priceCart } from "../utils/pricing";

const STEP_LABEL = { box: "gift box", item: "gift item", extra: "extra" } as const;

/** GET /curate/options — everything customers can pick, grouped by step. */
export const publicOptions = asyncHandler(async (_req: Request, res: Response) => {
  const all = await CurateOption.find({ isActive: true }).sort({ order: 1, createdAt: 1 }).lean();
  const out = all.map((o) => ({ ...o, soldOut: o.stock != null && o.stock <= 0 }));
  res.setHeader("Cache-Control", "public, max-age=30");
  ok(res, {
    boxes: out.filter((o) => o.step === "box"),
    items: out.filter((o) => o.step === "item"),
    extras: out.filter((o) => o.step === "extra"),
  });
});

/** POST /curate/price — validate & price a custom box before adding to cart. */
export const priceBox = asyncHandler(async (req: Request, res: Response) => {
  const quote = await priceCart([{ custom: req.body, qty: 1 }]);
  ok(res, quote.items[0], "Your box looks great.");
});

export const listOptions = asyncHandler(async (req: Request, res: Response) => {
  const filter: Record<string, any> = {};
  if (req.query.step) filter.step = req.query.step;
  ok(res, await CurateOption.find(filter).sort({ step: 1, order: 1, createdAt: 1 }).lean());
});

const imageFrom = (req: Request) => ((req as any).file?.path as string | undefined) || undefined;

export const createOption = asyncHandler(async (req: Request, res: Response) => {
  const o = await CurateOption.create({ ...req.body, image: imageFrom(req) || req.body.image || undefined });
  created(res, o, `${o.name} added — customers can pick it now.`);
});

export const updateOption = asyncHandler(async (req: Request, res: Response) => {
  const o = await CurateOption.findById(req.params.id);
  if (!o) throw AppError.notFound("Option");
  const img = imageFrom(req);
  Object.assign(o, req.body);
  if (img) o.image = img;
  if (req.body.removeImage === true) o.image = undefined;
  await o.save();
  const msg =
    Object.keys(req.body).length === 1 && "isActive" in req.body
      ? `${o.name} ${o.isActive ? "is now available" : "is hidden from customers"}.`
      : `${o.name} updated.`;
  ok(res, o, msg);
});

export const deleteOption = asyncHandler(async (req: Request, res: Response) => {
  const o = await CurateOption.findByIdAndDelete(req.params.id);
  if (!o) throw AppError.notFound("Option");
  ok(res, { id: req.params.id }, `${o.name} removed from the ${STEP_LABEL[o.step]} list.`);
});
