import { Schema, model, Types } from "mongoose";

export interface ICategory {
  name: string;
  slug: string;
  parent: Types.ObjectId | null;
  image?: string;
  order: number;
  isGiftType: boolean;
}

const categorySchema = new Schema<ICategory>(
  {
    name: { type: String, required: true, trim: true },
    slug: { type: String, required: true, unique: true, lowercase: true, index: true },
    parent: { type: Schema.Types.ObjectId, ref: "Category", default: null },
    image: { type: String },
    order: { type: Number, default: 0 },
    isGiftType: { type: Boolean, default: false },
  },
  { timestamps: true }
);

export default model<ICategory>("Category", categorySchema);
