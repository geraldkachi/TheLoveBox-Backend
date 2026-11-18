import { Router } from "express";
import {
  getProducts,
  getProductBySlug,
  getRelatedProducts,
  listProductsForAdmin,
  getProductById,
  createProduct,
  updateProduct,
  deleteProduct,
} from "../controllers/productController";
import { protect, requireRole } from "../middleware/auth";
import { validate, validObjectId } from "../middleware/validate";
import { upload, MAX_FILES } from "../config/cloudinary";
import { productCreateSchema, productUpdateSchema, productListQuery } from "../validators/schemas";

const router = Router();
const staff = [protect, requireRole("admin", "vendor")];
const media = upload.array("media", MAX_FILES) as any;

// Admin (registered before "/:slug" so "manage" isn't treated as a slug)
router.get("/manage/list", ...staff, validate(productListQuery, "query"), listProductsForAdmin);
router.get("/manage/:id", ...staff, validObjectId("id", "product"), getProductById);

// Public
router.get("/", validate(productListQuery, "query"), getProducts);
router.get("/:slug", getProductBySlug);
router.get("/:slug/related", getRelatedProducts);

// Admin writes — multer runs first so req.body is populated, then validation
router.post("/", ...staff, media, validate(productCreateSchema), createProduct);
router.put("/:id", ...staff, validObjectId("id", "product"), media, validate(productUpdateSchema), updateProduct);
router.delete("/:id", ...staff, validObjectId("id", "product"), deleteProduct);

export default router;
