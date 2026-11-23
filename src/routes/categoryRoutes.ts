import { Router } from "express";
import { getCategories, createCategory, updateCategory, deleteCategory } from "../controllers/categoryController";
import { protect, requireRole } from "../middleware/auth";
import { validate, validObjectId } from "../middleware/validate";
import { categoryCreateSchema, categoryUpdateSchema } from "../validators/schemas";

const router = Router();
const staff = [protect, requireRole("admin", "vendor")];

router.get("/", getCategories);
router.post("/", ...staff, validate(categoryCreateSchema), createCategory);
router.put("/:id", ...staff, validObjectId("id", "category"), validate(categoryUpdateSchema), updateCategory);
router.delete("/:id", ...staff, validObjectId("id", "category"), deleteCategory);

export default router;
