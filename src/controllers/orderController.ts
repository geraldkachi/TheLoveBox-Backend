import asyncHandler from "express-async-handler";
import { Request, Response } from "express";
import Order from "../models/Order";
import { generateOrderNumber } from "../utils/orderNumber";
import { priceCart } from "../utils/pricing";
import { AppError } from "../utils/AppError";
import { ok, created } from "../utils/respond";
import { escapeRegex } from "../utils/slugify";
import { AuthRequest } from "../middleware/auth";
import { notifyStatus, notifyShippingQuote } from "../emails/notify";
import { initShippingPayment } from "../utils/paystack";
import { sendMail } from "../emails/mailer";
import { orderReceivedEmail } from "../emails/templates";
import { logger } from "../utils/logger";

const STATUS_LABEL: Record<string, string> = {
  pending_payment: "Awaiting payment",
  paid: "Payment confirmed",
  processing: "Being prepared",
  out_for_delivery: "Out for delivery",
  delivered: "Delivered",
  cancelled: "Cancelled",
};

/** Customer-safe view of an order for the public tracking page. */
const publicOrder = (o: any) => ({
  orderNumber: o.orderNumber,
  status: o.status,
  items: o.items,
  subtotal: o.subtotal,
  deliveryFee: o.deliveryFee,
  discount: o.discount,
  total: o.total,
  deliveryDate: o.deliveryDate,
  trackingHistory: o.trackingHistory,
  createdAt: o.createdAt,
  shipping: {
    status: o.shipping?.status || "pending_quote",
    fee: o.shipping?.fee ?? null,
    note: o.shipping?.note,
  },
  customer: { name: o.customer?.name?.split(" ")[0] },
});

/** POST /orders/quote — price a cart (and validate a promo code) without creating anything. */
export const quoteOrder = asyncHandler(async (req: Request, res: Response) => {
  const quote = await priceCart(req.body.items, req.body.promoCode || undefined);
  ok(res, quote, quote.promo ? `${quote.promo.code} applied — ${quote.promo.label}.` : "Cart priced.");
});

export const createOrder = asyncHandler(async (req: AuthRequest, res: Response) => {
  const { customer, items, deliveryAddress, deliveryDate, giftMessage, promoCode } = req.body;
  const quote = await priceCart(items, promoCode || undefined, { email: customer.email });

  if (deliveryDate) {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    if (new Date(deliveryDate) < today) throw AppError.badRequest("Delivery date can't be in the past.", [{ field: "deliveryDate", message: "Pick today or a future date." }]);
  }

  // Retry on the (very unlikely) order-number collision
  let order;
  for (let attempt = 0; attempt < 3; attempt++) {
    try {
      order = await Order.create({
        orderNumber: generateOrderNumber(),
        customer,
        items: quote.items.map(({ kind, product, components, name, image, size, price, qty }) => ({ kind, product, components, name, image, size, price, qty })),
        deliveryAddress,
        deliveryDate,
        giftMessage,
        promoCode: quote.promo?.code,
        subtotal: quote.subtotal,
        deliveryFee: quote.deliveryFee,
        discount: quote.discount,
        total: quote.total,
        user: req.user?.id || null,
        status: "pending_payment",
        shipping: { status: "pending_quote", fee: null },
        trackingHistory: [{ status: "pending_payment", note: "Order created, awaiting payment.", at: new Date() }],
      });
      break;
    } catch (e: any) {
      if (e?.code !== 11000 || attempt === 2) throw e;
    }
  }

  created(res, order, `Order ${order!.orderNumber} created.`);
});

export const trackOrder = asyncHandler(async (req: Request, res: Response) => {
  const orderNumber = String(req.params.orderNumber || "").trim().toUpperCase();
  const order = await Order.findOne({ orderNumber }).lean();
  if (!order) throw new AppError(404, "We couldn't find an order with that number. Double-check and try again.", "ORDER_NOT_FOUND");
  ok(res, publicOrder(order), `Order found — ${STATUS_LABEL[order.status] || order.status}.`);
});

export const myOrders = asyncHandler(async (req: AuthRequest, res: Response) => {
  const orders = await Order.find({ $or: [{ user: req.user!.id }, { "customer.email": req.user!.email }] })
    .sort({ createdAt: -1 })
    .limit(50)
    .lean();
  ok(res, orders.map(publicOrder));
});

export const listOrders = asyncHandler(async (req: Request, res: Response) => {
  const { status, search, page, limit } = req.query as any;
  const filter: Record<string, any> = {};
  if (status) filter.status = status;
  if (search) {
    const rx = { $regex: escapeRegex(search), $options: "i" };
    filter.$or = [{ orderNumber: rx }, { "customer.name": rx }, { "customer.email": rx }, { "customer.phone": rx }];
  }

  const [items, total, counts] = await Promise.all([
    Order.find(filter).sort({ createdAt: -1 }).skip((page - 1) * limit).limit(limit).lean(),
    Order.countDocuments(filter),
    Order.aggregate([{ $group: { _id: "$status", count: { $sum: 1 } } }]),
  ]);
  const statusCounts = Object.fromEntries(counts.map((c: any) => [c._id, c.count]));
  ok(res, { items, total, page, pages: Math.max(1, Math.ceil(total / limit)), limit, statusCounts });
});

export const getOrder = asyncHandler(async (req: Request, res: Response) => {
  const order = await Order.findById(req.params.id).populate("items.product", "name slug images").lean();
  if (!order) throw AppError.notFound("Order");
  ok(res, order);
});

export const updateOrderStatus = asyncHandler(async (req: Request, res: Response) => {
  const { status, note, notify = true } = req.body;
  const order = await Order.findById(req.params.id);
  if (!order) throw AppError.notFound("Order");
  if (order.status === status && !note) throw AppError.badRequest(`This order is already "${STATUS_LABEL[status]}".`);
  if (order.status === "delivered" && status !== "delivered") {
    throw AppError.conflict("This order has already been delivered and can't be moved back.");
  }

  const changed = order.status !== status;
  order.status = status;
  order.trackingHistory.push({ status, note: note || STATUS_LABEL[status], at: new Date() });
  await order.save();

  let emailed = false;
  if (notify && changed && ["processing", "out_for_delivery", "delivered", "cancelled"].includes(status)) {
    const r = await notifyStatus(order.toObject(), status, note);
    emailed = r.sent;
  }
  ok(res, order, `${order.orderNumber} marked as "${STATUS_LABEL[status]}".${emailed ? " Customer emailed." : ""}`);
});

export const deleteOrder = asyncHandler(async (req: Request, res: Response) => {
  const order = await Order.findByIdAndDelete(req.params.id);
  if (!order) throw AppError.notFound("Order");
  ok(res, { id: req.params.id }, `Order ${order.orderNumber} deleted.`);
});

/**
 * PATCH /orders/:id/shipping { fee, note, waive, notify }
 * The team quotes delivery after the order; the customer gets an email with a Paystack link.
 */
export const setShipping = asyncHandler(async (req: Request, res: Response) => {
  const { fee, note, waive, notify = true } = req.body;
  const order = await Order.findById(req.params.id);
  if (!order) throw AppError.notFound("Order");
  if (order.status === "pending_payment") throw AppError.conflict("Wait for the customer to pay for the order before quoting shipping.");
  if (order.status === "cancelled") throw AppError.conflict("This order was cancelled.");
  if (order.shipping?.status === "paid") throw AppError.conflict("Shipping for this order has already been paid.");

  if (waive) {
    order.shipping = { ...(order.toObject().shipping || {}), status: "waived", fee: 0, note, quotedAt: new Date() } as any;
    order.trackingHistory.push({ status: order.status, note: "Shipping waived — delivery is free for this order.", at: new Date() });
    await order.save();
    return void ok(res, order, "Shipping waived for this order.");
  }

  order.shipping = { ...(order.toObject().shipping || {}), status: "awaiting_payment", fee, note, quotedAt: new Date() } as any;
  let linkMsg = "";
  try {
    const link = await initShippingPayment(order);
    order.shipping.paymentUrl = link.url;
  } catch (e: any) {
    logger.warn("Shipping link not created", { orderNumber: order.orderNumber, error: e?.message });
    linkMsg = " (No payment link — Paystack isn't reachable, so the email asks them to reply for payment details.)";
  }
  order.trackingHistory.push({ status: order.status, note: `Shipping fee confirmed: ₦${Number(fee).toLocaleString()}.`, at: new Date() });
  await order.save();

  let emailed = false;
  if (notify) emailed = (await notifyShippingQuote(order.toObject())).sent;
  ok(res, order, `Shipping set to ₦${Number(fee).toLocaleString()}.${emailed ? " Customer emailed a payment link." : " Email not sent — check Mailgun settings."}${linkMsg}`);
});

/** POST /orders/:id/resend-email { type: "receipt" | "shipping" | "status" } */
export const resendEmail = asyncHandler(async (req: Request, res: Response) => {
  const order = await Order.findById(req.params.id).lean();
  if (!order) throw AppError.notFound("Order");
  const { type } = req.body;
  let r: { sent: boolean; error?: string } = { sent: false };
  if (type === "receipt") {
    r = await sendMail({ to: order.customer.email, replyTo: process.env.SUPPORT_EMAIL, ...orderReceivedEmail(order) });
  } else if (type === "shipping") {
    if (order.shipping?.status !== "awaiting_payment") throw AppError.badRequest("There's no unpaid shipping fee to send.");
    r = await notifyShippingQuote(order);
  } else {
    r = await notifyStatus(order, order.status);
  }
  if (!r.sent) throw new AppError(502, `The email couldn't be sent${r.error ? `: ${r.error}` : ""}.`, "EMAIL_FAILED");
  ok(res, null, `Email sent to ${order.customer.email}.`);
});
