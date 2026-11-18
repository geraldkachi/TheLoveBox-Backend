import Product from "../models/Product";
import { AppError } from "./AppError";
import { config } from "../config/env";

export interface CartLineInput {
  product: string;
  size?: string;
  qty: number;
}

export interface PricedLine {
  product: string;
  name: string;
  slug: string;
  image: string;
  size: string;
  price: number;
  qty: number;
  lineTotal: number;
}

export interface Quote {
  items: PricedLine[];
  subtotal: number;
  deliveryFee: number;
  discount: number;
  total: number;
  promo: { code: string; percent: number } | null;
  freeDeliveryThreshold: number;
}

/**
 * Prices a cart using the database — never the client. This is what stops
 * someone editing the request to pay ₦1 for a ₦100,000 hamper.
 */
export async function priceCart(lines: CartLineInput[], promoCode?: string): Promise<Quote> {
  const ids = Array.from(new Set(lines.map((l) => l.product)));
  const products = await Product.find({ _id: { $in: ids } })
    .select("name slug images price sizes stock isActive")
    .lean();
  const byId = new Map(products.map((p) => [String(p._id), p]));

  // Merge duplicate product+size lines
  const merged = new Map<string, CartLineInput>();
  for (const l of lines) {
    const key = `${l.product}::${(l.size || "").toLowerCase()}`;
    const prev = merged.get(key);
    merged.set(key, prev ? { ...prev, qty: prev.qty + l.qty } : { ...l });
  }

  const items: PricedLine[] = [];
  for (const line of merged.values()) {
    const p = byId.get(line.product);
    if (!p || !p.isActive) {
      throw AppError.conflict("An item in your cart is no longer available. Please remove it and try again.");
    }

    let price = p.price;
    let sizeLabel = "Standard";
    if (p.sizes?.length) {
      const wanted = (line.size || "").trim().toLowerCase();
      const match = p.sizes.find((s) => (s.label || "").trim().toLowerCase() === wanted);
      if (!match) {
        throw AppError.badRequest(`Please choose a valid size for "${p.name}".`);
      }
      price = match.price;
      sizeLabel = match.label;
    }

    if (config.enforceStock && p.stock < line.qty) {
      throw AppError.conflict(
        p.stock <= 0 ? `"${p.name}" is sold out.` : `Only ${p.stock} of "${p.name}" left — please reduce the quantity.`
      );
    }

    items.push({
      product: String(p._id),
      name: p.name,
      slug: p.slug,
      image: p.images?.[0] || "",
      size: sizeLabel,
      price,
      qty: line.qty,
      lineTotal: price * line.qty,
    });
  }

  const subtotal = items.reduce((s, i) => s + i.lineTotal, 0);

  let promo: Quote["promo"] = null;
  if (promoCode) {
    const code = promoCode.trim().toUpperCase();
    const percent = config.promoCodes[code];
    if (!percent) throw AppError.badRequest(`"${code}" isn't a valid promo code.`, [{ field: "promoCode", message: "Invalid code" }]);
    promo = { code, percent };
  }

  const discount = promo ? Math.round((subtotal * promo.percent) / 100) : 0;
  const deliveryFee = subtotal === 0 || subtotal > config.freeDeliveryThreshold ? 0 : config.deliveryFee;
  const total = Math.max(0, subtotal - discount + deliveryFee);

  return { items, subtotal, deliveryFee, discount, total, promo, freeDeliveryThreshold: config.freeDeliveryThreshold };
}
