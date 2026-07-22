import { Schema, model, Types } from "mongoose";

export interface IOrderItem {
  product: Types.ObjectId;
  name: string;
  image: string;
  size: string;
  price: number;
  qty: number;
}

export interface IOrder {
  orderNumber: string;
  customer: {
    name: string;
    email: string;
    phone: string;
  };
  items: IOrderItem[];
  deliveryAddress: string;
  subtotal: number;
  deliveryFee: number;
  discount: number;
  total: number;
  status: "pending_payment" | "paid" | "processing" | "out_for_delivery" | "delivered" | "cancelled";
  paystackReference?: string;
  trackingHistory: { status: string; note?: string; at: Date }[];
}

const orderSchema = new Schema<IOrder>(
  {
    orderNumber: { type: String, required: true, unique: true, index: true },
    customer: {
      name: { type: String, required: true },
      email: { type: String, required: true },
      phone: { type: String, required: true },
    },
    items: [
      {
        product: { type: Schema.Types.ObjectId, ref: "Product" },
        name: String,
        image: String,
        size: String,
        price: Number,
        qty: Number,
      },
    ],
    deliveryAddress: { type: String, required: true },
    subtotal: { type: Number, required: true },
    deliveryFee: { type: Number, default: 0 },
    discount: { type: Number, default: 0 },
    total: { type: Number, required: true },
    status: {
      type: String,
      enum: ["pending_payment", "paid", "processing", "out_for_delivery", "delivered", "cancelled"],
      default: "pending_payment",
    },
    paystackReference: { type: String },
    trackingHistory: [
      {
        status: String,
        note: String,
        at: { type: Date, default: Date.now },
      },
    ],
  },
  { timestamps: true }
);

export default model<IOrder>("Order", orderSchema);
