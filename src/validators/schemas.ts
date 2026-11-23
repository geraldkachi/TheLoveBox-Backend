import { z } from "zod";
import mongoose from "mongoose";

const objectId = (label = "id") =>
  z.string({ required_error: `${label} is required.` }).refine((v) => mongoose.isValidObjectId(v), {
    message: `That ${label} isn't valid.`,
  });

const email = z
  .string({ required_error: "Email is required." })
  .trim()
  .toLowerCase()
  .email("Enter a valid email address.");

const phone = z
  .string({ required_error: "Phone number is required." })
  .trim()
  .regex(/^\+?[0-9\s-]{7,20}$/, "Enter a valid phone number.");

/* ---------- Auth ---------- */
export const registerSchema = z.object({
  name: z.string({ required_error: "Name is required." }).trim().min(2, "Name must be at least 2 characters.").max(80),
  email,
  password: z
    .string({ required_error: "Password is required." })
    .min(8, "Password must be at least 8 characters.")
    .max(128, "Password is too long."),
  role: z.enum(["customer", "vendor", "admin"]).optional(),
});

export const loginSchema = z.object({
  email,
  password: z.string({ required_error: "Password is required." }).min(1, "Password is required."),
});

/* ---------- Categories ---------- */
export const categoryCreateSchema = z.object({
  name: z.string({ required_error: "Category name is required." }).trim().min(2, "Category name is too short.").max(80),
  parent: objectId("parent category").nullable().optional().or(z.literal("")),
  image: z.string().url("Image must be a valid URL.").optional().or(z.literal("")),
  isGiftType: z.coerce.boolean().optional(),
  order: z.coerce.number().int().min(0).optional(),
});
export const categoryUpdateSchema = categoryCreateSchema.partial();

/* ---------- Products (multipart: everything arrives as strings) ---------- */
const jsonArray = <T extends z.ZodTypeAny>(item: T, label: string) =>
  z.preprocess((v) => {
    if (v === undefined || v === "") return undefined;
    if (Array.isArray(v)) return v;
    try {
      const parsed = JSON.parse(String(v));
      return Array.isArray(parsed) ? parsed : [parsed];
    } catch {
      return String(v)
        .split(",")
        .map((s) => s.trim())
        .filter(Boolean);
    }
  }, z.array(item, { invalid_type_error: `${label} must be a list.` }));

const boolish = z.preprocess((v) => (v === "true" ? true : v === "false" ? false : v), z.boolean());

const productBase = {
  name: z.string({ required_error: "Product name is required." }).trim().min(2, "Product name is too short.").max(140),
  description: z.string().max(5000, "Description is too long.").optional(),
  price: z.coerce.number({ invalid_type_error: "Price must be a number." }).positive("Price must be greater than 0."),
  compareAtPrice: z.preprocess((v) => (v === "" || v === "null" ? undefined : v), z.coerce.number().min(0).optional()),
  stock: z.coerce.number({ invalid_type_error: "Stock must be a number." }).int().min(0, "Stock can't be negative."),
  categories: jsonArray(objectId("category"), "Categories").refine((a) => a.length > 0, "Select at least one category."),
  giftTypes: jsonArray(objectId("gift type"), "Gift types").optional(),
  sizes: z
    .preprocess(
      (v) => (typeof v === "string" ? (v ? JSON.parse(v) : []) : v),
      z.array(
        z.object({
          label: z.string().trim().min(1, "Each size needs a label."),
          price: z.coerce.number().positive("Each size needs a price above 0."),
        })
      )
    )
    .optional(),
  isActive: boolish.optional(),
  isFeatured: boolish.optional(),
};

export const productCreateSchema = z.object(productBase);
export const productUpdateSchema = z
  .object({
    ...productBase,
    /** URLs of already-uploaded media to keep (anything not listed is removed). */
    existingMedia: jsonArray(z.string().url(), "Existing media").optional(),
  })
  .partial();

export const productListQuery = z.object({
  category: objectId("category").optional(),
  giftType: objectId("gift type").optional(),
  search: z.string().trim().max(100).optional(),
  featured: z.enum(["true", "false"]).optional(),
  sort: z.enum(["newest", "price_asc", "price_desc", "name"]).optional(),
  minPrice: z.coerce.number().min(0).optional(),
  maxPrice: z.coerce.number().min(0).optional(),
  status: z.enum(["all", "active", "inactive"]).optional(),
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(200).default(24),
});

/* ---------- Orders ---------- */
const qty = z.coerce.number().int("Quantity must be a whole number.").min(1, "Quantity must be at least 1.").max(99);

const productLine = z.object({
  product: objectId("product"),
  size: z.string().trim().max(80).optional(),
  qty,
});

const pick = z.object({ option: objectId("option"), qty: z.coerce.number().int().min(1).max(50) });
export const customBoxSchema = z.object({
  box: objectId("gift box"),
  items: z.array(pick).min(1, "Add at least one gift item to your box.").max(40),
  extras: z.array(pick).max(40).optional(),
});
const customLine = z.object({ custom: customBoxSchema, qty });

export const cartItemSchema = z.union([customLine, productLine]);

export const quoteSchema = z.object({
  items: z.array(cartItemSchema).min(1, "Your cart is empty."),
  promoCode: z.string().trim().max(30).optional().or(z.literal("")),
});

export const createOrderSchema = quoteSchema.extend({
  customer: z.object({
    name: z.string({ required_error: "Your name is required." }).trim().min(2, "Enter your full name.").max(120),
    email,
    phone,
  }),
  deliveryAddress: z
    .string({ required_error: "Delivery address is required." })
    .trim()
    .min(8, "Enter a complete delivery address.")
    .max(500),
  deliveryDate: z.coerce.date().optional(),
  giftMessage: z.string().trim().max(500, "Gift message must be 500 characters or fewer.").optional(),
});

export const ORDER_STATUSES = ["pending_payment", "paid", "processing", "out_for_delivery", "delivered", "cancelled"] as const;

export const updateStatusSchema = z.object({
  status: z.enum(ORDER_STATUSES, { errorMap: () => ({ message: "Choose a valid order status." }) }),
  note: z.string().trim().max(300).optional(),
  notify: z.boolean().optional(),
});

export const shippingSchema = z
  .object({
    fee: z.coerce.number({ invalid_type_error: "Shipping fee must be a number." }).positive("Shipping fee must be more than ₦0.").max(1_000_000).optional(),
    note: z.string().trim().max(200).optional(),
    waive: z.boolean().optional(),
    notify: z.boolean().optional(),
  })
  .refine((v) => v.waive || v.fee, { message: "Enter the shipping fee, or waive it.", path: ["fee"] });

export const resendEmailSchema = z.object({ type: z.enum(["receipt", "shipping", "status"]) });

/* ---------- Discounts ---------- */
const optionalDate = z.preprocess((v) => (v === "" || v === null ? null : v), z.coerce.date().nullable().optional());
const discountBase = {
  code: z.string({ required_error: "Code is required." }).trim().toUpperCase().regex(/^[A-Z0-9_-]{3,30}$/, "Use 3–30 letters, numbers, - or _ (no spaces)."),
  type: z.enum(["percent", "fixed"]),
  value: z.coerce.number({ invalid_type_error: "Discount must be a number." }).positive("Discount must be more than 0."),
  isActive: z.boolean().optional(),
  isVisible: z.boolean().optional(),
  headline: z.string().trim().max(80).optional().or(z.literal("")),
  description: z.string().trim().max(200).optional().or(z.literal("")),
  minSubtotal: z.coerce.number().min(0).optional(),
  firstOrderOnly: z.boolean().optional(),
  startsAt: optionalDate,
  endsAt: optionalDate,
  maxUses: z.preprocess((v) => (v === "" || v === null ? null : v), z.coerce.number().int().min(1).nullable().optional()),
};
export const discountCreateSchema = z.object(discountBase).refine((v) => !v.startsAt || !v.endsAt || v.endsAt > v.startsAt, { message: "The end date must be after the start date.", path: ["endsAt"] });
export const discountUpdateSchema = z.object(discountBase).partial();

/* ---------- Curate options (multipart) ---------- */
const bool = z.preprocess((v) => (v === "true" ? true : v === "false" ? false : v), z.boolean());
const nullableInt = z.preprocess((v) => (v === "" || v === "null" || v === null ? null : v), z.coerce.number().int().min(0).nullable());
const curateBase = {
  step: z.enum(["box", "item", "extra"], { errorMap: () => ({ message: "Choose box, gift item or extra." }) }),
  name: z.string({ required_error: "Name is required." }).trim().min(2, "Name is too short.").max(120),
  description: z.string().trim().max(400).optional(),
  price: z.coerce.number({ invalid_type_error: "Price must be a number." }).min(0, "Price can't be negative."),
  group: z.string().trim().max(40).optional(),
  capacity: z.coerce.number().int().min(1, "A box must hold at least 1 item.").max(50).optional(),
  maxPerOrder: z.coerce.number().int().min(1).max(50).optional(),
  stock: nullableInt.optional(),
  isActive: bool.optional(),
  order: z.coerce.number().int().optional(),
  removeImage: bool.optional(),
};
export const curateCreateSchema = z.object(curateBase);
export const curateUpdateSchema = z.object(curateBase).partial();

export const orderListQuery = z.object({
  status: z.enum(ORDER_STATUSES).optional().or(z.literal("")),
  search: z.string().trim().max(100).optional(),
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(20),
});

export const initPaymentSchema = z.object({
  orderNumber: z.string({ required_error: "Order number is required." }).trim().min(4),
});

/* ---------- Contact ---------- */
export const contactSchema = z.object({
  name: z.string({ required_error: "Your name is required." }).trim().min(2, "Enter your name.").max(120),
  email,
  phone: z.string().trim().max(30).optional().or(z.literal("")),
  message: z.string({ required_error: "Message is required." }).trim().min(10, "Tell us a little more (10+ characters).").max(4000),
});

export const newsletterSchema = z.object({ email });
