import Order from "../models/Order";
import Product from "../models/Product";
import CurateOption from "../models/CurateOption";
import Discount from "../models/Discount";
import { logger } from "./logger";
import { notifyOrderPaid, notifyShippingPaid } from "../emails/notify";

/**
 * Marks an order as paid exactly once (safe to call from both the verify
 * endpoint and the webhook), deducts stock, counts the promo use and emails.
 */
export async function markOrderPaid(orderNumber: string, reference: string, amountKobo: number) {
  const order = await Order.findOne({ orderNumber });
  if (!order) return { ok: false as const, reason: "ORDER_NOT_FOUND" };
  if (order.status !== "pending_payment") return { ok: true as const, order, alreadyProcessed: true };

  const expected = Math.round(order.total * 100);
  if (amountKobo < expected) {
    order.trackingHistory.push({
      status: order.status,
      note: `Payment amount mismatch: received ₦${(amountKobo / 100).toLocaleString()}, expected ₦${order.total.toLocaleString()}. Needs review.`,
      at: new Date(),
    });
    await order.save();
    logger.warn("Payment amount mismatch", { orderNumber, amountKobo, expected });
    return { ok: false as const, reason: "AMOUNT_MISMATCH", order };
  }

  const updated = await Order.findOneAndUpdate(
    { _id: order._id, status: "pending_payment" },
    {
      $set: { status: "paid", paystackReference: reference, paidAt: new Date(), amountPaid: amountKobo / 100 },
      $push: { trackingHistory: { status: "paid", note: "Payment confirmed via Paystack. Shipping fee to follow.", at: new Date() } },
    },
    { new: true }
  );
  if (!updated) return { ok: true as const, order: await Order.findById(order._id), alreadyProcessed: true };

  if (!updated.stockDeducted) {
    const jobs: Promise<unknown>[] = [];
    for (const i of updated.items) {
      if (i.kind === "custom") {
        for (const c of i.components || []) {
          jobs.push(CurateOption.updateOne({ _id: c.option, stock: { $ne: null, $gte: c.qty * i.qty } }, { $inc: { stock: -(c.qty * i.qty) } }).catch(() => null));
        }
      } else if (i.product) {
        jobs.push(Product.updateOne({ _id: i.product, stock: { $gte: i.qty } }, { $inc: { stock: -i.qty } }).catch(() => null));
      }
    }
    if (updated.promoCode) jobs.push(Discount.updateOne({ code: updated.promoCode }, { $inc: { usedCount: 1 } }).catch(() => null));
    await Promise.all(jobs);
    updated.stockDeducted = true;
    await updated.save();
  }

  void notifyOrderPaid(updated.toObject());
  return { ok: true as const, order: updated, alreadyProcessed: false };
}

/** Shipping is paid separately after the team quotes it. */
export async function markShippingPaid(orderNumber: string, reference: string, amountKobo: number) {
  const order = await Order.findOne({ orderNumber });
  if (!order) return { ok: false as const, reason: "ORDER_NOT_FOUND" };
  if (order.shipping?.status === "paid") return { ok: true as const, order, alreadyProcessed: true };
  if (order.shipping?.status !== "awaiting_payment" || !order.shipping.fee) return { ok: false as const, reason: "NO_SHIPPING_DUE", order };

  if (amountKobo < Math.round(order.shipping.fee * 100)) {
    logger.warn("Shipping amount mismatch", { orderNumber, amountKobo, fee: order.shipping.fee });
    return { ok: false as const, reason: "AMOUNT_MISMATCH", order };
  }

  const updated = await Order.findOneAndUpdate(
    { _id: order._id, "shipping.status": "awaiting_payment" },
    {
      $set: { "shipping.status": "paid", "shipping.paidAt": new Date(), "shipping.reference": reference },
      $push: { trackingHistory: { status: order.status, note: `Shipping fee of ₦${order.shipping.fee.toLocaleString()} paid.`, at: new Date() } },
    },
    { new: true }
  );
  if (!updated) return { ok: true as const, order: await Order.findById(order._id), alreadyProcessed: true };
  void notifyShippingPaid(updated.toObject());
  return { ok: true as const, order: updated, alreadyProcessed: false };
}
