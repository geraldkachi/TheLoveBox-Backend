import asyncHandler from "express-async-handler";
import { Request, Response } from "express";
import Category from "../models/Category";
import Product from "../models/Product";
import { slugify } from "../utils/slugify";
import { AppError } from "../utils/AppError";
import { ok, created } from "../utils/respond";

export const getCategories = asyncHandler(async (_req: Request, res: Response) => {
  const categories = await Category.find().sort({ order: 1, name: 1 }).lean();
  res.setHeader("Cache-Control", "public, max-age=60, stale-while-revalidate=300");
  ok(res, categories);
});

async function buildSlug(name: string, parentId?: string | null) {
  let base = slugify(name);
  if (parentId) {
    const parent = await Category.findById(parentId).select("slug").lean();
    if (!parent) throw AppError.badRequest("The parent category you picked doesn't exist.");
    base = `${parent.slug}-${base}`;
  }
  return base;
}

export const createCategory = asyncHandler(async (req: Request, res: Response) => {
  const { name, parent, image, isGiftType, order } = req.body;
  const slug = await buildSlug(name, parent || null);
  if (await Category.exists({ slug })) throw AppError.conflict(`A category called "${name}" already exists here.`);

  const category = await Category.create({
    name,
    slug,
    parent: parent || null,
    image: image || undefined,
    isGiftType: !!isGiftType,
    order: order || 0,
  });
  created(res, category, `"${category.name}" added — it's now live on the site.`);
});

export const updateCategory = asyncHandler(async (req: Request, res: Response) => {
  const { id } = req.params;
  const category = await Category.findById(id);
  if (!category) throw AppError.notFound("Category");

  const { name, parent, image, isGiftType, order } = req.body;
  if (parent !== undefined && parent && String(parent) === id) {
    throw AppError.badRequest("A category can't be its own parent.");
  }
  if (name !== undefined) category.name = name;
  if (parent !== undefined) category.parent = (parent || null) as any;
  if (image !== undefined) category.image = image || undefined;
  if (isGiftType !== undefined) category.isGiftType = !!isGiftType;
  if (order !== undefined) category.order = order;
  if (name !== undefined || parent !== undefined) {
    const slug = await buildSlug(category.name, category.parent ? String(category.parent) : null);
    if (slug !== category.slug && (await Category.exists({ slug, _id: { $ne: id } }))) {
      throw AppError.conflict(`A category called "${category.name}" already exists here.`);
    }
    category.slug = slug;
  }
  await category.save();
  ok(res, category, "Category updated.");
});

export const deleteCategory = asyncHandler(async (req: Request, res: Response) => {
  const { id } = req.params;
  const category = await Category.findById(id);
  if (!category) throw AppError.notFound("Category");

  const children = await Category.countDocuments({ parent: id });
  if (children > 0) {
    throw AppError.conflict(`"${category.name}" has ${children} subcategor${children === 1 ? "y" : "ies"}. Delete or move them first.`);
  }
  const productCount = await Product.countDocuments({ $or: [{ categories: id }, { giftTypes: id }] });
  if (productCount > 0) {
    throw AppError.conflict(
      `${productCount} product${productCount === 1 ? " is" : "s are"} still in "${category.name}". Move ${productCount === 1 ? "it" : "them"} to another category first.`
    );
  }
  await category.deleteOne();
  ok(res, { id }, `"${category.name}" deleted.`);
});
