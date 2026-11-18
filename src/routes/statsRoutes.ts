import { Router } from "express";
import { overview } from "../controllers/statsController";
import { protect, requireRole } from "../middleware/auth";

const router = Router();
router.get("/overview", protect, requireRole("admin", "vendor"), overview);

export default router;
