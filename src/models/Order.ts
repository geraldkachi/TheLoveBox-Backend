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
  promoCode?: string;
  giftMessage?: string;
  deliveryDate?: Date;
  paidAt?: Date;
  amountPaid?: number;
  stockDeducted?: boolean;
  user?: Types.ObjectId | null;
  trackingHistory: { status: string; note?: string; at: Date }[];
}

const orderSchema = new Schema<IOrder>(
  {
    orderNumber: { type: String, required: true, unique: true, index: true },
    customer: {
      name: { type: String, required: true, trim: true },
      email: { type: String, required: true, lowercase: true, trim: true, index: true },
      phone: { type: String, required: true, trim: true },
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
      index: true,
    },
    paystackReference: { type: String, index: true },
    promoCode: { type: String },
    giftMessage: { type: String, maxlength: 500 },
    deliveryDate: { type: Date },
    paidAt: { type: Date },
    amountPaid: { type: Number },
    stockDeducted: { type: Boolean, default: false },
    user: { type: Schema.Types.ObjectId, ref: "User", default: null },
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

orderSchema.index({ createdAt: -1 });

export default model<IOrder>("Order", orderSchema);
