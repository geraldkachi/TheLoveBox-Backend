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
export const cartItemSchema = z.object({
  product: objectId("product"),
  size: z.string().trim().max(80).optional(),
  qty: z.coerce.number().int("Quantity must be a whole number.").min(1, "Quantity must be at least 1.").max(99),
});

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
});

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
