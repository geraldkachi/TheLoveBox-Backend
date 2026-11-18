import { Router } from "express";
import rateLimit from "express-rate-limit";
import { initializePayment, verifyPayment, paystackWebhook } from "../controllers/paymentController";
import { validate } from "../middleware/validate";
import { initPaymentSchema } from "../validators/schemas";

const router = Router();
const payLimiter = rateLimit({
  windowMs: 10 * 60 * 1000,
  limit: 30,
  standardHeaders: true,
  legacyHeaders: false,
  message: { success: false, code: "RATE_LIMITED", message: "Too many payment attempts. Please wait a few minutes." },
});

router.post("/initialize", payLimiter, validate(initPaymentSchema), initializePayment);
router.get("/verify/:reference", payLimiter, verifyPayment);
router.post("/webhook", paystackWebhook);

export default router;
