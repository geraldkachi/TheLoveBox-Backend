import { Schema, model } from "mongoose";

export interface IInquiry {
  name: string;
  email: string;
  phone?: string;
  message: string;
  status: "new" | "read" | "resolved";
}

const inquirySchema = new Schema<IInquiry>(
  {
    name: { type: String, required: true, trim: true, maxlength: 120 },
    email: { type: String, required: true, lowercase: true, trim: true },
    phone: { type: String, trim: true },
    message: { type: String, required: true, maxlength: 4000 },
    status: { type: String, enum: ["new", "read", "resolved"], default: "new" },
  },
  { timestamps: true }
);

export default model<IInquiry>("Inquiry", inquirySchema);
