import asyncHandler from "express-async-handler";
import { Request, Response } from "express";
import Order from "../models/Order";

const PAYSTACK_BASE = "https://api.paystack.co";

export const initializePayment = asyncHandler(async (req: Request, res: Response) => {
  const { email, amount, orderNumber } = req.body;

  const response = await fetch(`${PAYSTACK_BASE}/transaction/initialize`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${process.env.PAYSTACK_SECRET_KEY}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      email,
      amount: Math.round(amount * 100),
      metadata: { orderNumber },
      callback_url: `${process.env.CUSTOMER_APP_URL}/checkout/success`,
    }),
  });

  const data = await response.json();
  if (!data.status) {
    res.status(400);
    throw new Error(data.message || "Could not start payment.");
  }
  res.json(data.data);
});

export const verifyPayment = asyncHandler(async (req: Request, res: Response) => {
  const { reference } = req.params;

  const response = await fetch(`${PAYSTACK_BASE}/transaction/verify/${reference}`, {
    headers: { Authorization: `Bearer ${process.env.PAYSTACK_SECRET_KEY}` },
  });
  const data = await response.json();

  if (data.status && data.data.status === "success") {
    const orderNumber = data.data.metadata?.orderNumber;
    if (orderNumber) {
      const order = await Order.findOne({ orderNumber });
      if (order && order.status === "pending_payment") {
        order.status = "paid";
        order.paystackReference = reference;
        order.trackingHistory.push({ status: "paid", note: "Payment confirmed via Paystack.", at: new Date() });
        await order.save();
      }
    }
    res.json({ verified: true, data: data.data });
  } else {
    res.status(400).json({ verified: false, message: "Payment could not be verified." });
  }
});
