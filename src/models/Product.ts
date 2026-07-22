import { Schema, model, Types } from "mongoose";

export interface IProduct {
  name: string;
  slug: string;
  description: string;
  images: string[];
  videos: string[];
  price: number;
  compareAtPrice?: number;
  categories: Types.ObjectId[];
  giftTypes: Types.ObjectId[];
  sizes: { label: string; price: number }[];
  stock: number;
  isActive: boolean;
  isFeatured: boolean;
}

const productSchema = new Schema<IProduct>(
  {
    name: { type: String, required: true, trim: true },
    slug: { type: String, required: true, unique: true, lowercase: true, index: true },
    description: { type: String, default: "" },
    images: { type: [String], default: [] },
    videos: { type: [String], default: [] },
    price: { type: Number, required: true },
    compareAtPrice: { type: Number },
    categories: {
      type: [{ type: Schema.Types.ObjectId, ref: "Category" }],
      required: true,
      validate: {
        validator: (v: Types.ObjectId[]) => Array.isArray(v) && v.length > 0,
        message: "Select at least one category.",
      },
    },
    giftTypes: [{ type: Schema.Types.ObjectId, ref: "Category" }],
    sizes: [
      {
        label: String,
        price: Number,
      },
    ],
    stock: { type: Number, default: 0 },
    isActive: { type: Boolean, default: true },
    isFeatured: { type: Boolean, default: false },
  },
  { timestamps: true }
);

productSchema.index({ name: "text", description: "text" });
productSchema.index({ categories: 1 });

export default model<IProduct>("Product", productSchema);
