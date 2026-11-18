import { logger } from "../utils/logger";

/**
 * Fail fast on boot if something critical is missing, instead of failing on
 * the first request in production.
 */
const REQUIRED = ["MONGODB_URI", "JWT_SECRET"] as const;
const RECOMMENDED = [
  "PAYSTACK_SECRET_KEY",
  "CLOUDINARY_CLOUD_NAME",
  "CLOUDINARY_API_KEY",
  "CLOUDINARY_API_SECRET",
  "CUSTOMER_APP_URL",
] as const;

export function validateEnv() {
  const missing = REQUIRED.filter((k) => !process.env[k]);
  if (missing.length) {
    throw new Error(`Missing required environment variables: ${missing.join(", ")}`);
  }
  const soft = RECOMMENDED.filter((k) => !process.env[k]);
  if (soft.length) logger.warn("Some optional environment variables are not set", { missing: soft });
  if ((process.env.JWT_SECRET || "").length < 16) {
    logger.warn("JWT_SECRET is short — use at least 32 random characters in production.");
  }
}

const list = (v?: string) =>
  (v || "")
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean);

export const config = {
  get isProd() {
    return process.env.NODE_ENV === "production";
  },
  get corsOrigins() {
    return Array.from(
      new Set([
        "http://localhost:3000",
        "http://localhost:5173",
        "https://the-love-box-customer.vercel.app",
        "https://the-love-box-admin.vercel.app",
        ...list(process.env.CUSTOMER_APP_URL),
        ...list(process.env.ADMIN_APP_URL),
        ...list(process.env.CORS_ORIGINS),
      ])
    );
  },
  get deliveryFee() {
    return Number(process.env.DELIVERY_FEE ?? 3500);
  },
  get freeDeliveryThreshold() {
    return Number(process.env.FREE_DELIVERY_THRESHOLD ?? 100000);
  },
  get enforceStock() {
    return process.env.ENFORCE_STOCK === "true";
  },
  /** PROMO_CODES="LOVE10:10,VAL20:20" → percent off. Defaults to LOVE10 (10%). */
  get promoCodes(): Record<string, number> {
    const raw = process.env.PROMO_CODES || "LOVE10:10";
    const out: Record<string, number> = {};
    for (const pair of list(raw)) {
      const [code, pct] = pair.split(":");
      const n = Number(pct);
      if (code && n > 0 && n <= 100) out[code.toUpperCase()] = n;
    }
    return out;
  },
};
