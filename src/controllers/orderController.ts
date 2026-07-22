import asyncHandler from "express-async-handler";
import { Request, Response } from "express";
import Order from "../models/Order";
import { generateOrderNumber } from "../utils/orderNumber";

export const createOrder = asyncHandler(async (req: Request, res: Response) => {
  const { customer, items, deliveryAddress, subtotal, deliveryFee, discount, total } = req.body;

  const order = await Order.create({
    orderNumber: generateOrderNumber(),
    customer,
    items,
    deliveryAddress,
    subtotal,
    deliveryFee,
    discount,
    total,
    status: "pending_payment",
    trackingHistory: [{ status: "pending_payment", note: "Order created, awaiting payment.", at: new Date() }],
  });

  res.status(201).json(order);
});

export const trackOrder = asyncHandler(async (req: Request, res: Response) => {
  const { orderNumber } = req.params;
  const order = await Order.findOne({ orderNumber });
  if (!order) {
    res.status(404);
    throw new Error("We couldn't find an order with that number.");
  }
  res.json(order);
});

export const listOrders = asyncHandler(async (req: Request, res: Response) => {
  const { status, page = "1", limit = "20" } = req.query;
  const filter: Record<string, any> = {};
  if (status) filter.status = status;

  const pageNum = Number(page);
  const limitNum = Number(limit);

  const [items, total] = await Promise.all([
    Order.find(filter).sort({ createdAt: -1 }).skip((pageNum - 1) * limitNum).limit(limitNum).lean(),
    Order.countDocuments(filter),
  ]);
  res.json({ items, total, page: pageNum, pages: Math.ceil(total / limitNum) });
});

export const updateOrderStatus = asyncHandler(async (req: Request, res: Response) => {
  const { id } = req.params;
  const { status, note } = req.body;
  const order = await Order.findById(id);
  if (!order) {
    res.status(404);
    throw new Error("Order not found.");
  }
  order.status = status;
  order.trackingHistory.push({ status, note, at: new Date() });
  await order.save();
  res.json(order);
});
