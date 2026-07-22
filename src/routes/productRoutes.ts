import { Router } from "express";
import {
  getProducts,
  getProductBySlug,
  getRelatedProducts,
  createProduct,
  updateProduct,
  deleteProduct,
} from "../controllers/productController";
import { protect, requireRole } from "../middleware/auth";
import { upload } from "../config/cloudinary";

const router = Router();
router.get("/", getProducts);
router.get("/:slug", getProductBySlug);
router.get("/:slug/related", getRelatedProducts);
router.post("/", protect, requireRole("admin", "vendor"), upload.array("media", 8) as any, createProduct);
router.put("/:id", protect, requireRole("admin", "vendor"), upload.array("media", 8) as any, updateProduct);
router.delete("/:id", protect, requireRole("admin", "vendor"), deleteProduct);

export default router;
