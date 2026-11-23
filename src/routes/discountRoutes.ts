import { Router } from "express";
import { featuredDiscount, listDiscounts, createDiscount, updateDiscount, deleteDiscount } from "../controllers/discountController";
import { protect, requireRole } from "../middleware/auth";
import { validate, validObjectId } from "../middleware/validate";
import { discountCreateSchema, discountUpdateSchema } from "../validators/schemas";

const router = Router();
const admin = [protect, requireRole("admin")];

router.get("/featured", featuredDiscount);
router.get("/", ...admin, listDiscounts);
router.post("/", ...admin, validate(discountCreateSchema), createDiscount);
router.put("/:id", ...admin, validObjectId("id", "discount"), validate(discountUpdateSchema), updateDiscount);
router.delete("/:id", ...admin, validObjectId("id", "discount"), deleteDiscount);

export default router;
