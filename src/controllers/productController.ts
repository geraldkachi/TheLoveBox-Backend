import asyncHandler from "express-async-handler";
import { Request, Response } from "express";
import Product from "../models/Product";

const slugify = (s: string) =>
  s.toLowerCase().trim().replace(/[^a-z0-9]+/g, "-").replace(/(^-|-$)/g, "") + "-" + Date.now().toString(36);

export const getProducts = asyncHandler(async (req: Request, res: Response) => {
  const { category, giftType, search, page = "1", limit = "24" } = req.query;

  const filter: Record<string, any> = { isActive: true };
  if (category) filter.categories = category;
  if (giftType) filter.giftTypes = giftType;
  if (search) filter.$text = { $search: String(search) };

  const pageNum = Number(page);
  const limitNum = Number(limit);

  const [items, total] = await Promise.all([
    Product.find(filter)
      .populate("categories", "name slug")
      .populate("giftTypes", "name slug")
      .sort({ createdAt: -1 })
      .skip((pageNum - 1) * limitNum)
      .limit(limitNum)
      .lean(),
    Product.countDocuments(filter),
  ]);

  res.json({ items, total, page: pageNum, pages: Math.ceil(total / limitNum) });
});

export const getProductBySlug = asyncHandler(async (req: Request, res: Response) => {
  const product = await Product.findOne({ slug: req.params.slug, isActive: true })
    .populate("categories", "name slug")
    .populate("giftTypes", "name slug");
  if (!product) {
    res.status(404);
    throw new Error("Product not found.");
  }
  res.json(product);
});

export const getRelatedProducts = asyncHandler(async (req: Request, res: Response) => {
  const product = await Product.findOne({ slug: req.params.slug });
  if (!product) {
    res.json([]);
    return;
  }
  const related = await Product.find({
    _id: { $ne: product._id },
    categories: { $in: product.categories },
    isActive: true,
  })
    .populate("categories", "name slug")
    .limit(8)
    .lean();
  res.json(related);
});

function splitMedia(files: Express.Multer.File[]) {
  const images: string[] = [];
  const videos: string[] = [];
  for (const f of files) {
    const url = (f as any).path;
    if (f.mimetype.startsWith("video/")) videos.push(url);
    else images.push(url);
  }
  return { images, videos };
}

function parseCategories(body: Record<string, any>): string[] {
  if (!body.categories) return [];
  try {
    const parsed = JSON.parse(body.categories);
    return Array.isArray(parsed) ? parsed : [parsed];
  } catch {
    // fall back to a single value or comma-separated string sent without JSON.stringify
    return String(body.categories)
      .split(",")
      .map((s) => s.trim())
      .filter(Boolean);
  }
}

export const createProduct = asyncHandler(async (req: Request, res: Response) => {
  const body = req.body;
  const files = (req.files as Express.Multer.File[]) || [];
  const { images, videos } = splitMedia(files);

  const categories = parseCategories(body);
  if (!categories.length) {
    res.status(400);
    throw new Error("Select at least one category for this product.");
  }

  const product = await Product.create({
    ...body,
    slug: slugify(body.name),
    images,
    videos,
    categories,
    giftTypes: body.giftTypes ? JSON.parse(body.giftTypes) : [],
    sizes: body.sizes ? JSON.parse(body.sizes) : [],
  });
  res.status(201).json(product);
});

export const updateProduct = asyncHandler(async (req: Request, res: Response) => {
  const { id } = req.params;
  const body = req.body;
  const files = (req.files as Express.Multer.File[]) || [];

  const update: Record<string, any> = { ...body };
  if (body.categories) update.categories = parseCategories(body);
  if (body.giftTypes) update.giftTypes = JSON.parse(body.giftTypes);
  if (body.sizes) update.sizes = JSON.parse(body.sizes);
  if (files.length) {
    const { images, videos } = splitMedia(files);
    if (images.length) update.images = images;
    if (videos.length) update.videos = videos;
  }

  const product = await Product.findByIdAndUpdate(id, update, { new: true });
  if (!product) {
    res.status(404);
    throw new Error("Product not found.");
  }
  res.json(product);
});

export const deleteProduct = asyncHandler(async (req: Request, res: Response) => {
  const product = await Product.findByIdAndDelete(req.params.id);
  if (!product) {
    res.status(404);
    throw new Error("Product not found.");
  }
  res.json({ message: "Product deleted." });
});
