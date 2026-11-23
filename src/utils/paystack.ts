import { AppError } from "./AppError";
import { logger } from "./logger";

const PAYSTACK_BASE = "https://api.paystack.co";

export async function paystack(path: string, init?: RequestInit) {
  const secret = process.env.PAYSTACK_SECRET_KEY;
  if (!secret) throw new AppError(503, "Online payment isn't configured yet. Please contact us on WhatsApp to complete your order.", "PAYMENTS_DISABLED");

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 15000);
  try {
    const response = await fetch(`${PAYSTACK_BASE}${path}`, {
      ...init,
      signal: controller.signal,
      headers: { Authorization: `Bearer ${secret}`, "Content-Type": "application/json", ...(init?.headers || {}) },
    });
    const data: any = await response.json().catch(() => ({}));
    return { httpOk: response.ok, data };
  } catch (e: any) {
    logger.error("Paystack request failed", { path, error: e?.message });
    throw AppError.upstream();
  } finally {
    clearTimeout(timer);
  }
}


export const callbackUrl = (path = "/checkout/success") => {
  const base = (process.env.CUSTOMER_APP_URL || "").split(",")[0].trim().replace(/\/$/, "");
  return base ? `${base}${path}` : undefined;
};

/** Creates a Paystack checkout link for an order's shipping fee. */
export async function initShippingPayment(order: any) {
  const reference = `${order.orderNumber}-SHIP-${Date.now().toString(36).toUpperCase()}`;
  const cb = callbackUrl();
  const { data } = await paystack("/transaction/initialize", {
    method: "POST",
    body: JSON.stringify({
      email: order.customer.email,
      amount: Math.round(order.shipping.fee * 100),
      currency: "NGN",
      reference,
      metadata: { orderNumber: order.orderNumber, kind: "shipping" },
      ...(cb ? { callback_url: cb } : {}),
    }),
  });
  if (!data?.status) throw new AppError(400, data?.message || "Couldn't create the shipping payment link.", "PAYMENT_INIT_FAILED");
  return { url: data.data.authorization_url as string, reference };
}
