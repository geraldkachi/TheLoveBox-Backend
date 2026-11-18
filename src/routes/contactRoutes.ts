import { Router } from "express";
import rateLimit from "express-rate-limit";
import { submitInquiry, listInquiries, subscribe } from "../controllers/contactController";
import { protect, requireRole } from "../middleware/auth";
import { validate } from "../middleware/validate";
import { contactSchema, newsletterSchema } from "../validators/schemas";

const router = Router();
const formLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 10,
  standardHeaders: true,
  legacyHeaders: false,
  message: { success: false, code: "RATE_LIMITED", message: "You've sent a few messages already — please try again later." },
});

router.post("/contact", formLimiter, validate(contactSchema), submitInquiry);
router.get("/contact", protect, requireRole("admin", "vendor"), listInquiries);
router.post("/newsletter", formLimiter, validate(newsletterSchema), subscribe);

export default router;
