import Order from "../models/Order";
import Product from "../models/Product";
import { logger } from "./logger";

/**
 * Marks an order as paid exactly once (safe to call from both the verify
 * endpoint and the webhook) and deducts stock on the first transition.
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

  // Atomic transition guards against verify + webhook racing each other
  const updated = await Order.findOneAndUpdate(
    { _id: order._id, status: "pending_payment" },
    {
      $set: { status: "paid", paystackReference: reference, paidAt: new Date(), amountPaid: amountKobo / 100 },
      $push: { trackingHistory: { status: "paid", note: "Payment confirmed via Paystack.", at: new Date() } },
    },
    { new: true }
  );
  if (!updated) return { ok: true as const, order: await Order.findById(order._id), alreadyProcessed: true };

  if (!updated.stockDeducted) {
    await Promise.all(
      updated.items.map((i) =>
        Product.updateOne({ _id: i.product, stock: { $gte: i.qty } }, { $inc: { stock: -i.qty } }).catch(() => null)
      )
    );
    updated.stockDeducted = true;
    await updated.save();
  }
  return { ok: true as const, order: updated, alreadyProcessed: false };
}
