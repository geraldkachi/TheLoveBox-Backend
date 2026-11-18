import asyncHandler from "express-async-handler";
import { Request, Response } from "express";
import crypto from "crypto";
import Order from "../models/Order";
import { AppError } from "../utils/AppError";
import { ok } from "../utils/respond";
import { markOrderPaid } from "../utils/fulfilment";
import { logger } from "../utils/logger";

const PAYSTACK_BASE = "https://api.paystack.co";

async function paystack(path: string, init?: RequestInit) {
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

/**
 * POST /payments/initialize { orderNumber }
 * Amount and email come from the stored order — the client can't change them.
 */
export const initializePayment = asyncHandler(async (req: Request, res: Response) => {
  const order = await Order.findOne({ orderNumber: req.body.orderNumber.toUpperCase() });
  if (!order) throw AppError.notFound("Order");
  if (order.status !== "pending_payment") throw AppError.conflict("This order has already been paid for.");

  const reference = `${order.orderNumber}-${Date.now().toString(36).toUpperCase()}`;
  const callbackBase = (process.env.CUSTOMER_APP_URL || "").split(",")[0].trim().replace(/\/$/, "");

  const { data } = await paystack("/transaction/initialize", {
    method: "POST",
    body: JSON.stringify({
      email: order.customer.email,
      amount: Math.round(order.total * 100),
      currency: "NGN",
      reference,
      metadata: { orderNumber: order.orderNumber, customerName: order.customer.name },
      ...(callbackBase ? { callback_url: `${callbackBase}/checkout/success` } : {}),
    }),
  });

  if (!data?.status) {
    logger.warn("Paystack initialize rejected", { orderNumber: order.orderNumber, message: data?.message });
    throw new AppError(400, data?.message || "We couldn't start the payment. Please try again.", "PAYMENT_INIT_FAILED");
  }

  ok(res, { ...data.data, orderNumber: order.orderNumber, amount: order.total }, "Redirecting you to secure checkout…");
});

/** GET /payments/verify/:reference — called by the success page after redirect. */
export const verifyPayment = asyncHandler(async (req: Request, res: Response) => {
  const reference = String(req.params.reference || "").trim();
  if (!/^[A-Za-z0-9._=-]{6,120}$/.test(reference)) throw AppError.badRequest("That payment reference isn't valid.");

  const { data } = await paystack(`/transaction/verify/${encodeURIComponent(reference)}`);
  const tx = data?.data;

  if (!data?.status || !tx) throw new AppError(404, "We couldn't find this payment. If you were charged, contact us with your reference.", "PAYMENT_NOT_FOUND");
  if (tx.status !== "success") {
    const msg: Record<string, string> = {
      abandoned: "This payment wasn't completed.",
      failed: "This payment failed. No money was taken — please try again.",
      pending: "Your payment is still processing. We'll update your order as soon as it clears.",
    };
    throw new AppError(402, msg[tx.status] || "This payment wasn't successful.", "PAYMENT_NOT_SUCCESSFUL");
  }
  if (tx.currency && tx.currency !== "NGN") throw AppError.badRequest("Unexpected payment currency. Please contact support.");

  const orderNumber = tx.metadata?.orderNumber || String(reference).split("-").slice(0, 3).join("-");
  const result = await markOrderPaid(orderNumber, reference, Number(tx.amount));

  if (!result.ok) {
    if (result.reason === "AMOUNT_MISMATCH") {
      throw new AppError(409, "The amount paid doesn't match your order. Our team has been notified and will reach out.", "AMOUNT_MISMATCH");
    }
    throw new AppError(404, "Payment received, but we couldn't match it to an order. Please contact us with your reference.", "ORDER_NOT_FOUND");
  }

  ok(
    res,
    { verified: true, orderNumber: result.order!.orderNumber, status: result.order!.status, total: result.order!.total },
    result.alreadyProcessed ? "Payment already confirmed." : "Payment confirmed — thank you!"
  );
});

/**
 * POST /payments/webhook — Paystack server-to-server notification.
 * Confirms payments even if the customer closes the tab before redirecting.
 */
export const paystackWebhook = asyncHandler(async (req: Request, res: Response) => {
  const secret = process.env.PAYSTACK_SECRET_KEY || "";
  const raw: Buffer | undefined = (req as any).rawBody;
  const signature = req.headers["x-paystack-signature"] as string | undefined;

  const expected = raw ? crypto.createHmac("sha512", secret).update(raw).digest("hex") : "";
  const valid =
    !!signature &&
    !!expected &&
    signature.length === expected.length &&
    crypto.timingSafeEqual(Buffer.from(signature), Buffer.from(expected));
  if (!valid) throw AppError.unauthorized("Invalid webhook signature.");

  const event = req.body;
  if (event?.event === "charge.success") {
    const tx = event.data;
    const orderNumber = tx?.metadata?.orderNumber;
    if (orderNumber) {
      const result = await markOrderPaid(orderNumber, tx.reference, Number(tx.amount));
      logger.info("Webhook processed", { orderNumber, ok: result.ok, reason: (result as any).reason });
    }
  }
  res.sendStatus(200);
});
