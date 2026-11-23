/**
 * Starter "Curate your own gift" catalogue + a LOVE10 discount.
 * Run once: yarn seed:curate   (skips anything that already exists)
 * Then replace names, prices and photos from the Studio → Curate page.
 */
import dotenv from "dotenv";
dotenv.config();
import mongoose from "mongoose";
import CurateOption from "../models/CurateOption";
import Discount from "../models/Discount";

const options = [
  { step: "box", name: "Petite Keepsake Box", description: "Kraft box with satin ribbon", price: 8000, capacity: 3, order: 1 },
  { step: "box", name: "Signature Love Box", description: "Rigid box, tissue and wax seal", price: 15000, capacity: 6, order: 2 },
  { step: "box", name: "Grand Hamper Basket", description: "Woven basket wrapped in cellophane", price: 25000, capacity: 10, order: 3 },
  { step: "item", name: "Scented soy candle", price: 9500, order: 1 },
  { step: "item", name: "Silk scrunchie set", price: 6000, order: 2 },
  { step: "item", name: "Personalised mug", price: 8500, order: 3 },
  { step: "item", name: "Rose gold jewellery dish", price: 7000, order: 4 },
  { step: "item", name: "Luxury body butter", price: 11000, order: 5 },
  { step: "item", name: "Leather notebook", price: 9000, order: 6 },
  { step: "extra", group: "Food & treats", name: "Assorted chocolates", price: 6500, order: 1 },
  { step: "extra", group: "Food & treats", name: "Red velvet cupcakes (4)", price: 8000, order: 2 },
  { step: "extra", group: "Drinks", name: "Sparkling grape juice", price: 7500, order: 3 },
  { step: "extra", group: "Drinks", name: "Rosé wine", price: 18000, order: 4 },
  { step: "extra", group: "Greeting cards", name: "Handwritten card", price: 1500, maxPerOrder: 1, order: 5 },
  { step: "extra", group: "Greeting cards", name: "Pop-up birthday card", price: 3500, maxPerOrder: 2, order: 6 },
];

(async () => {
  await mongoose.connect(process.env.MONGODB_URI as string);
  let added = 0;
  for (const o of options) {
    if (!(await CurateOption.exists({ step: o.step, name: o.name }))) {
      await CurateOption.create(o);
      added++;
    }
  }
  if (!(await Discount.exists({ code: "LOVE10" }))) {
    await Discount.create({ code: "LOVE10", type: "percent", value: 10, isActive: true, isVisible: true, firstOrderOnly: true, headline: "Enjoy 10% off your first order" });
    console.log("Created LOVE10 (10% off first order, showing on site)");
  }
  console.log(`Curate options added: ${added}`);
  await mongoose.disconnect();
})().catch((e) => {
  console.error(e);
  process.exit(1);
});
