import { Schema, model } from "mongoose";

/**
 * Building blocks for "Curate your own gift". The admin decides exactly
 * which boxes, items and extras customers can choose from.
 *  - box:   the container (choose one). `capacity` caps how many gift items fit.
 *  - item:  gift items that go inside the box (count toward capacity)
 *  - extra: food, drinks and greeting cards (grouped by `group`)
 */
export interface ICurateOption {
  step: "box" | "item" | "extra";
  name: string;
  description?: string;
  image?: string;
  price: number;
  group?: string;
  capacity?: number;
  maxPerOrder: number;
  stock?: number | null;
  isActive: boolean;
  order: number;
}

const curateOptionSchema = new Schema<ICurateOption>(
  {
    step: { type: String, enum: ["box", "item", "extra"], required: true, index: true },
    name: { type: String, required: true, trim: true, maxlength: 120 },
    description: { type: String, maxlength: 400 },
    image: String,
    price: { type: Number, required: true, min: 0 },
    group: { type: String, trim: true, maxlength: 40 },
    capacity: { type: Number, min: 1, default: 6 },
    maxPerOrder: { type: Number, min: 1, default: 5 },
    stock: { type: Number, default: null },
    isActive: { type: Boolean, default: true },
    order: { type: Number, default: 0 },
  },
  { timestamps: true }
);

export default model<ICurateOption>("CurateOption", curateOptionSchema);
