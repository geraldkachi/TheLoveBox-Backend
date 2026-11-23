import Product from "../models/Product";
import CurateOption from "../models/CurateOption";
import Discount from "../models/Discount";
import Order from "../models/Order";
import { AppError } from "./AppError";
import { config } from "../config/env";

export interface ProductLineInput {
  product: string;
  size?: string;
  qty: number;
}
export interface CustomLineInput {
  custom: {
    box: string;
    items: { option: string; qty: number }[];
    extras?: { option: string; qty: number }[];
  };
  qty: number;
}
export type CartLineInput = ProductLineInput | CustomLineInput;

export interface PricedComponent {
  option: string;
  step: "box" | "item" | "extra";
  name: string;
  image?: string;
  price: number;
  qty: number;
}

export interface PricedLine {
  kind: "product" | "custom";
  product: string | null;
  components?: PricedComponent[];
  name: string;
  slug?: string;
  image: string;
  size: string;
  price: number;
  qty: number;
  lineTotal: number;
}

export interface Quote {
  items: PricedLine[];
  subtotal: number;
  /** Always 0 at checkout — shipping is quoted by the team after the order. */
  deliveryFee: number;
  shippingNote: string;
  discount: number;
  total: number;
  promo: { code: string; type: "percent" | "fixed"; value: number; label: string } | null;
}

export const SHIPPING_NOTE = "Shipping fee will be communicated after order confirmation.";

const isCustom = (l: CartLineInput): l is CustomLineInput => "custom" in l && !!(l as any).custom;

/* ---------------- Custom boxes ---------------- */
async function priceCustomLines(lines: CustomLineInput[]): Promise<PricedLine[]> {
  if (!lines.length) return [];
  const ids = new Set<string>();
  for (const l of lines) {
    ids.add(l.custom.box);
    l.custom.items.forEach((i) => ids.add(i.option));
    (l.custom.extras || []).forEach((i) => ids.add(i.option));
  }
  const options = await CurateOption.find({ _id: { $in: [...ids] } }).lean();
  const byId = new Map(options.map((o) => [String(o._id), o]));

  return lines.map((line) => {
    const box = byId.get(line.custom.box);
    if (!box || !box.isActive || box.step !== "box") {
      throw AppError.conflict("The gift box you picked is no longer available. Please choose another box.");
    }

    const components: PricedComponent[] = [{ option: String(box._id), step: "box", name: box.name, image: box.image, price: box.price, qty: 1 }];
    const take = (list: { option: string; qty: number }[], step: "item" | "extra") => {
      for (const sel of list) {
        const o = byId.get(sel.option);
        if (!o || !o.isActive || o.step !== step) {
          throw AppError.conflict("Something in your custom box is no longer available. Please review your selection.");
        }
        if (sel.qty > o.maxPerOrder) throw AppError.badRequest(`You can add up to ${o.maxPerOrder} × "${o.name}".`);
        if (config.enforceStock && o.stock != null && o.stock < sel.qty * line.qty) {
          throw AppError.conflict(o.stock <= 0 ? `"${o.name}" is sold out.` : `Only ${o.stock} of "${o.name}" left.`);
        }
        components.push({ option: String(o._id), step, name: o.name, image: o.image, price: o.price, qty: sel.qty });
      }
    };
    take(line.custom.items, "item");
    take(line.custom.extras || [], "extra");

    const itemCount = line.custom.items.reduce((n, i) => n + i.qty, 0);
    if (itemCount < 1) throw AppError.badRequest("Add at least one gift item to your box.");
    const capacity = box.capacity || 6;
    if (itemCount > capacity) {
      throw AppError.badRequest(`The ${box.name} holds up to ${capacity} gift items — you've chosen ${itemCount}.`);
    }

    const price = components.reduce((s, c) => s + c.price * c.qty, 0);
    return {
      kind: "custom" as const,
      product: null,
      components,
      name: `Curated gift box — ${box.name}`,
      image: box.image || components.find((c) => c.image)?.image || "",
      size: "Curated",
      price,
      qty: line.qty,
      lineTotal: price * line.qty,
    };
  });
}

/* ---------------- Catalogue products ---------------- */
async function priceProductLines(lines: ProductLineInput[]): Promise<PricedLine[]> {
  if (!lines.length) return [];
  const ids = Array.from(new Set(lines.map((l) => l.product)));
  const products = await Product.find({ _id: { $in: ids } }).select("name slug images price sizes stock isActive").lean();
  const byId = new Map(products.map((p) => [String(p._id), p]));

  const merged = new Map<string, ProductLineInput>();
  for (const l of lines) {
    const key = `${l.product}::${(l.size || "").toLowerCase()}`;
    const prev = merged.get(key);
    merged.set(key, prev ? { ...prev, qty: prev.qty + l.qty } : { ...l });
  }

  const out: PricedLine[] = [];
  for (const line of merged.values()) {
    const p = byId.get(line.product);
    if (!p || !p.isActive) throw AppError.conflict("An item in your cart is no longer available. Please remove it and try again.");

    let price = p.price;
    let sizeLabel = "Standard";
    if (p.sizes?.length) {
      const wanted = (line.size || "").trim().toLowerCase();
      const match = p.sizes.find((s) => (s.label || "").trim().toLowerCase() === wanted);
      if (!match) throw AppError.badRequest(`Please choose a valid size for "${p.name}".`);
      price = match.price;
      sizeLabel = match.label;
    }
    if (config.enforceStock && p.stock < line.qty) {
      throw AppError.conflict(p.stock <= 0 ? `"${p.name}" is sold out.` : `Only ${p.stock} of "${p.name}" left — please reduce the quantity.`);
    }
    out.push({ kind: "product", product: String(p._id), name: p.name, slug: p.slug, image: p.images?.[0] || "", size: sizeLabel, price, qty: line.qty, lineTotal: price * line.qty });
  }
  return out;
}

/* ---------------- Discounts ---------------- */
export const discountLabel = (d: { type: string; value: number }) =>
  d.type === "percent" ? `${d.value}% off` : `₦${d.value.toLocaleString("en-NG")} off`;

export async function resolveDiscount(rawCode: string, subtotal: number, email?: string) {
  const code = rawCode.trim().toUpperCase();
  const d = await Discount.findOne({ code }).lean();
  const invalid = (msg: string) => AppError.badRequest(msg, [{ field: "promoCode", message: msg }]);

  if (!d || !d.isActive) throw invalid(`"${code}" isn't a valid promo code.`);
  const now = new Date();
  if (d.startsAt && d.startsAt > now) throw invalid(`"${code}" isn't active yet.`);
  if (d.endsAt && d.endsAt < now) throw invalid(`"${code}" has expired.`);
  if (d.maxUses != null && d.usedCount >= d.maxUses) throw invalid(`"${code}" has been fully redeemed.`);
  if (subtotal < (d.minSubtotal || 0)) {
    throw invalid(`"${code}" needs a subtotal of at least ₦${d.minSubtotal.toLocaleString("en-NG")}.`);
  }
  if (d.firstOrderOnly && email) {
    const previous = await Order.exists({ "customer.email": email.toLowerCase(), status: { $in: ["paid", "processing", "out_for_delivery", "delivered"] } });
    if (previous) throw invalid(`"${code}" is for first orders only.`);
  }

  const amount = d.type === "percent" ? Math.round((subtotal * d.value) / 100) : Math.min(subtotal, d.value);
  return { code: d.code, type: d.type, value: d.value, label: discountLabel(d), amount };
}

/**
 * Prices a cart using the database — never the client. Handles catalogue
 * products and curated boxes; shipping is quoted later by the team.
 */
export async function priceCart(lines: CartLineInput[], promoCode?: string, opts: { email?: string } = {}): Promise<Quote> {
  const [productLines, customLines] = await Promise.all([
    priceProductLines(lines.filter((l): l is ProductLineInput => !isCustom(l))),
    priceCustomLines(lines.filter(isCustom)),
  ]);
  const items = [...productLines, ...customLines];
  const subtotal = items.reduce((s, i) => s + i.lineTotal, 0);

  let promo: Quote["promo"] = null;
  let discount = 0;
  if (promoCode) {
    const d = await resolveDiscount(promoCode, subtotal, opts.email);
    promo = { code: d.code, type: d.type, value: d.value, label: d.label };
    discount = d.amount;
  }

  return { items, subtotal, deliveryFee: 0, shippingNote: SHIPPING_NOTE, discount, total: Math.max(0, subtotal - discount), promo };
}
