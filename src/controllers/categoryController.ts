import asyncHandler from "express-async-handler";
import { Request, Response } from "express";
import Category from "../models/Category";

const slugify = (s: string) =>
  s.toLowerCase().trim().replace(/[^a-z0-9]+/g, "-").replace(/(^-|-$)/g, "");

export const getCategories = asyncHandler(async (req: Request, res: Response) => {
  const categories = await Category.find().sort({ order: 1, name: 1 }).lean();
  res.json(categories);
});

export const createCategory = asyncHandler(async (req: Request, res: Response) => {
  const { name, parent, image, isGiftType, order } = req.body;
  const category = await Category.create({
    name,
    slug: slugify(name),
    parent: parent || null,
    image,
    isGiftType: !!isGiftType,
    order: order || 0,
  });
  res.status(201).json(category);
});

export const updateCategory = asyncHandler(async (req: Request, res: Response) => {
  const { id } = req.params;
  const updates = { ...req.body };
  if (updates.name) updates.slug = slugify(updates.name);
  const category = await Category.findByIdAndUpdate(id, updates, { new: true });
  if (!category) {
    res.status(404);
    throw new Error("Category not found.");
  }
  res.json(category);
});

export const deleteCategory = asyncHandler(async (req: Request, res: Response) => {
  const { id } = req.params;
  const children = await Category.countDocuments({ parent: id });
  if (children > 0) {
    res.status(400);
    throw new Error("Delete or reassign subcategories before deleting this category.");
  }
  await Category.findByIdAndDelete(id);
  res.json({ message: "Category deleted." });
});
