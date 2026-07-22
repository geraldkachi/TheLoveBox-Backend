import { Router } from "express";
import { getCategories, createCategory, updateCategory, deleteCategory } from "../controllers/categoryController";
import { protect, requireRole } from "../middleware/auth";

const router = Router();
router.get("/", getCategories);
router.post("/", protect, requireRole("admin", "vendor"), createCategory);
router.put("/:id", protect, requireRole("admin", "vendor"), updateCategory);
router.delete("/:id", protect, requireRole("admin", "vendor"), deleteCategory);

export default router;
