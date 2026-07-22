import asyncHandler from "express-async-handler";
import { Request, Response } from "express";
import Product from "../models/Product";
import Category from "../models/Category";

export const search = asyncHandler(async (req: Request, res: Response) => {
  const q = String(req.query.q || "").trim();
  if (!q) {
    res.json({ products: [], categories: [] });
    return;
  }

  const [products, categories] = await Promise.all([
    Product.find({ isActive: true, $text: { $search: q } })
      .populate("categories", "name slug")
      .limit(12)
      .lean(),
    Category.find({ name: { $regex: q, $options: "i" } }).limit(8).lean(),
  ]);

  // fall back to a loose regex match on name if the text index found nothing
  // (handles partial words / typos better for a small catalog)
  let productResults = products;
  if (!productResults.length) {
    productResults = await Product.find({
      isActive: true,
      name: { $regex: q, $options: "i" },
    })
      .populate("categories", "name slug")
      .limit(12)
      .lean();
  }

  res.json({ products: productResults, categories });
});
