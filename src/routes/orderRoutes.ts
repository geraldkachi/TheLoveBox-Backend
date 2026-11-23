import { Router } from "express";
import {
  quoteOrder,
  createOrder,
  trackOrder,
  myOrders,
  listOrders,
  getOrder,
  updateOrderStatus,
  deleteOrder,
  setShipping,
  resendEmail,
} from "../controllers/orderController";
import { protect, requireRole, optionalAuth } from "../middleware/auth";
import { validate, validObjectId } from "../middleware/validate";
import { quoteSchema, createOrderSchema, updateStatusSchema, orderListQuery, shippingSchema, resendEmailSchema } from "../validators/schemas";

const router = Router();
const staff = [protect, requireRole("admin", "vendor")];

// Customer
router.post("/quote", validate(quoteSchema), quoteOrder);
router.post("/", optionalAuth, validate(createOrderSchema), createOrder);
router.get("/track/:orderNumber", trackOrder);
router.get("/mine", protect, myOrders);

// Staff
router.get("/", ...staff, validate(orderListQuery, "query"), listOrders);
router.get("/:id", ...staff, validObjectId("id", "order"), getOrder);
router.patch("/:id/status", ...staff, validObjectId("id", "order"), validate(updateStatusSchema), updateOrderStatus);
router.patch("/:id/shipping", ...staff, validObjectId("id", "order"), validate(shippingSchema), setShipping);
router.post("/:id/resend-email", ...staff, validObjectId("id", "order"), validate(resendEmailSchema), resendEmail);
router.delete("/:id", protect, requireRole("admin"), validObjectId("id", "order"), deleteOrder);

export default router;
