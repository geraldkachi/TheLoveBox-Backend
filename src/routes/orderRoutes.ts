import { Router } from "express";
import { createOrder, trackOrder, listOrders, updateOrderStatus } from "../controllers/orderController";
import { protect, requireRole } from "../middleware/auth";

const router = Router();
router.post("/", createOrder);
router.get("/track/:orderNumber", trackOrder);
router.get("/", protect, requireRole("admin", "vendor"), listOrders);
router.patch("/:id/status", protect, requireRole("admin", "vendor"), updateOrderStatus);

export default router;
