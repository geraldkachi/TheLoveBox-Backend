import asyncHandler from "express-async-handler";
import { Request, Response } from "express";
import Order from "../models/Order";
import { generateOrderNumber } from "../utils/orderNumber";
import { priceCart } from "../utils/pricing";
import { AppError } from "../utils/AppError";
import { ok, created } from "../utils/respond";
import { escapeRegex } from "../utils/slugify";
import { AuthRequest } from "../middleware/auth";

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
  customer: { name: o.customer?.name?.split(" ")[0] },
});

/** POST /orders/quote — price a cart (and validate a promo code) without creating anything. */
export const quoteOrder = asyncHandler(async (req: Request, res: Response) => {
  const quote = await priceCart(req.body.items, req.body.promoCode || undefined);
  ok(res, quote, quote.promo ? `${quote.promo.code} applied — ${quote.promo.percent}% off.` : "Cart priced.");
});

export const createOrder = asyncHandler(async (req: AuthRequest, res: Response) => {
  const { customer, items, deliveryAddress, deliveryDate, giftMessage, promoCode } = req.body;
  const quote = await priceCart(items, promoCode || undefined);

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
        items: quote.items.map(({ product, name, image, size, price, qty }) => ({ product, name, image, size, price, qty })),
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
  const { status, note } = req.body;
  const order = await Order.findById(req.params.id);
  if (!order) throw AppError.notFound("Order");
  if (order.status === status && !note) throw AppError.badRequest(`This order is already "${STATUS_LABEL[status]}".`);
  if (order.status === "delivered" && status !== "delivered") {
    throw AppError.conflict("This order has already been delivered and can't be moved back.");
  }

  order.status = status;
  order.trackingHistory.push({ status, note: note || STATUS_LABEL[status], at: new Date() });
  await order.save();
  ok(res, order, `${order.orderNumber} marked as "${STATUS_LABEL[status]}".`);
});

export const deleteOrder = asyncHandler(async (req: Request, res: Response) => {
  const order = await Order.findByIdAndDelete(req.params.id);
  if (!order) throw AppError.notFound("Order");
  ok(res, { id: req.params.id }, `Order ${order.orderNumber} deleted.`);
});
