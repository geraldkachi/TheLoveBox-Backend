import { customAlphabet } from "nanoid";

const nanoid = customAlphabet("0123456789", 6);

export function generateOrderNumber() {
  const date = new Date();
  const yy = String(date.getFullYear()).slice(2);
  const mm = String(date.getMonth() + 1).padStart(2, "0");
  return `TLB-${yy}${mm}-${nanoid()}`;
}
