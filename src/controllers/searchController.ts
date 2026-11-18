import asyncHandler from "express-async-handler";
import { Request, Response } from "express";
import Product from "../models/Product";
import Category from "../models/Category";
import { escapeRegex } from "../utils/slugify";
import { ok } from "../utils/respond";

export const search = asyncHandler(async (req: Request, res: Response) => {
  const q = String(req.query.q || "").trim().slice(0, 100);
  if (!q) return void ok(res, { products: [], categories: [] });

  const rx = { $regex: escapeRegex(q), $options: "i" };
  const [textHits, categories] = await Promise.all([
    Product.find({ isActive: true, $text: { $search: q } }, { score: { $meta: "textScore" } })
      .sort({ score: { $meta: "textScore" } })
      .populate("categories", "name slug")
      .limit(24)
      .lean()
      .catch(() => [] as any[]),
    Category.find({ name: rx }).limit(8).lean(),
  ]);

  // Fall back to a partial-name match (handles half-typed words better for a small catalog)
  const products = textHits.length
    ? textHits
    : await Product.find({ isActive: true, name: rx }).populate("categories", "name slug").limit(24).lean();

  ok(res, { products, categories }, `${products.length + categories.length} result(s) for "${q}".`);
});
