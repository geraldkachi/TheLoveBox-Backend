import { Schema, model } from "mongoose";

export interface IDiscount {
  code: string;
  type: "percent" | "fixed";
  value: number;
  isActive: boolean;
  /** Advertised on the storefront (popup + announcement bar). Only one at a time. */
  isVisible: boolean;
  headline?: string;
  description?: string;
  minSubtotal: number;
  firstOrderOnly: boolean;
  startsAt?: Date | null;
  endsAt?: Date | null;
  maxUses?: number | null;
  usedCount: number;
}

const discountSchema = new Schema<IDiscount>(
  {
    code: { type: String, required: true, unique: true, uppercase: true, trim: true },
    type: { type: String, enum: ["percent", "fixed"], default: "percent" },
    value: { type: Number, required: true, min: 0 },
    isActive: { type: Boolean, default: true },
    isVisible: { type: Boolean, default: false, index: true },
    headline: { type: String, maxlength: 80 },
    description: { type: String, maxlength: 200 },
    minSubtotal: { type: Number, default: 0 },
    firstOrderOnly: { type: Boolean, default: false },
    startsAt: { type: Date, default: null },
    endsAt: { type: Date, default: null },
    maxUses: { type: Number, default: null },
    usedCount: { type: Number, default: 0 },
  },
  { timestamps: true }
);

export default model<IDiscount>("Discount", discountSchema);
