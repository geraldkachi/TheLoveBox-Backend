import asyncHandler from "express-async-handler";
import { Request, Response } from "express";
import Product from "../models/Product";
import { uniqueSlug, escapeRegex } from "../utils/slugify";
import { AppError } from "../utils/AppError";
import { ok, created } from "../utils/respond";
import { cloudinary } from "../config/cloudinary";
import { logger } from "../utils/logger";

const SORTS: Record<string, Record<string, 1 | -1>> = {
  newest: { createdAt: -1 },
  price_asc: { price: 1 },
  price_desc: { price: -1 },
  name: { name: 1 },
};

function buildFilter(q: any, includeInactive = false) {
  const filter: Record<string, any> = {};
  if (!includeInactive) filter.isActive = true;
  else if (q.status === "active") filter.isActive = true;
  else if (q.status === "inactive") filter.isActive = false;

  if (q.category) filter.categories = q.category;
  if (q.giftType) filter.giftTypes = q.giftType;
  if (q.featured === "true") filter.isFeatured = true;
  if (q.minPrice !== undefined || q.maxPrice !== undefined) {
    filter.price = {};
    if (q.minPrice !== undefined) filter.price.$gte = q.minPrice;
    if (q.maxPrice !== undefined) filter.price.$lte = q.maxPrice;
  }
  if (q.search) filter.name = { $regex: escapeRegex(q.search), $options: "i" };
  return filter;
}

async function paginate(filter: Record<string, any>, q: any) {
  const { page, limit } = q;
  const [items, total] = await Promise.all([
    Product.find(filter)
      .populate("categories", "name slug")
      .populate("giftTypes", "name slug")
      .sort(SORTS[q.sort || "newest"])
      .skip((page - 1) * limit)
      .limit(limit)
      .lean(),
    Product.countDocuments(filter),
  ]);
  return { items, total, page, pages: Math.max(1, Math.ceil(total / limit)), limit };
}

/* ---------- Public ---------- */
export const getProducts = asyncHandler(async (req: Request, res: Response) => {
  ok(res, await paginate(buildFilter(req.query), req.query));
});

export const getProductBySlug = asyncHandler(async (req: Request, res: Response) => {
  const product = await Product.findOne({ slug: req.params.slug, isActive: true })
    .populate("categories", "name slug")
    .populate("giftTypes", "name slug")
    .lean();
  if (!product) throw AppError.notFound("Product");
  ok(res, product);
});

export const getRelatedProducts = asyncHandler(async (req: Request, res: Response) => {
  const product = await Product.findOne({ slug: req.params.slug }).select("categories").lean();
  if (!product) return void ok(res, []);
  const related = await Product.find({
    _id: { $ne: product._id },
    categories: { $in: product.categories },
    isActive: true,
  })
    .populate("categories", "name slug")
    .limit(8)
    .lean();
  ok(res, related);
});

/* ---------- Admin ---------- */
export const listProductsForAdmin = asyncHandler(async (req: Request, res: Response) => {
  ok(res, await paginate(buildFilter(req.query, true), req.query));
});

export const getProductById = asyncHandler(async (req: Request, res: Response) => {
  const product = await Product.findById(req.params.id).populate("categories", "name slug").populate("giftTypes", "name slug").lean();
  if (!product) throw AppError.notFound("Product");
  ok(res, product);
});

function splitMedia(files: Express.Multer.File[]) {
  const images: string[] = [];
  const videos: string[] = [];
  for (const f of files) {
    const url = (f as any).path as string;
    if (!url) continue;
    if (f.mimetype.startsWith("video/")) videos.push(url);
    else images.push(url);
  }
  return { images, videos };
}

/** Best-effort cleanup of Cloudinary files we no longer reference. */
async function destroyMedia(urls: string[]) {
  await Promise.all(
    urls.map(async (url) => {
      const m = url.match(/\/upload\/(?:v\d+\/)?(.+)\.[a-z0-9]+$/i);
      if (!m) return;
      const resource_type = url.includes("/video/") ? "video" : "image";
      try {
        await cloudinary.uploader.destroy(m[1], { resource_type });
      } catch (e: any) {
        logger.warn("Cloudinary cleanup failed", { url, error: e?.message });
      }
    })
  );
}

export const createProduct = asyncHandler(async (req: Request, res: Response) => {
  const files = (req.files as Express.Multer.File[]) || [];
  const { images, videos } = splitMedia(files);
  const b = req.body;

  const product = await Product.create({
    name: b.name,
    description: b.description || "",
    price: b.price,
    compareAtPrice: b.compareAtPrice,
    stock: b.stock,
    categories: b.categories,
    giftTypes: b.giftTypes || [],
    sizes: b.sizes || [],
    isActive: b.isActive ?? true,
    isFeatured: b.isFeatured ?? false,
    slug: uniqueSlug(b.name),
    images,
    videos,
  });
  created(res, product, `"${product.name}" is now live in your store.`);
});

export const updateProduct = asyncHandler(async (req: Request, res: Response) => {
  const product = await Product.findById(req.params.id);
  if (!product) throw AppError.notFound("Product");

  const files = (req.files as Express.Multer.File[]) || [];
  const b = req.body;

  const fields = ["name", "description", "price", "compareAtPrice", "stock", "categories", "giftTypes", "sizes", "isActive", "isFeatured"] as const;
  for (const f of fields) {
    if (b[f] !== undefined) (product as any)[f] = b[f];
  }

  // Media: keep what the admin kept, drop the rest, then append new uploads
  const removed: string[] = [];
  if (Array.isArray(b.existingMedia)) {
    const keep = new Set<string>(b.existingMedia);
    removed.push(...product.images.filter((u) => !keep.has(u)), ...product.videos.filter((u) => !keep.has(u)));
    product.images = product.images.filter((u) => keep.has(u));
    product.videos = product.videos.filter((u) => keep.has(u));
  }
  const { images, videos } = splitMedia(files);
  product.images.push(...images);
  product.videos.push(...videos);

  await product.save();
  if (removed.length) destroyMedia(removed);
  ok(res, product, `"${product.name}" updated.`);
});

export const deleteProduct = asyncHandler(async (req: Request, res: Response) => {
  const product = await Product.findByIdAndDelete(req.params.id);
  if (!product) throw AppError.notFound("Product");
  destroyMedia([...(product.images || []), ...(product.videos || [])]);
  ok(res, { id: req.params.id }, `"${product.name}" deleted.`);
});
