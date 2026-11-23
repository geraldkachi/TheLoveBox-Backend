import { Router } from "express";
import { publicOptions, priceBox, listOptions, createOption, updateOption, deleteOption } from "../controllers/curateController";
import { protect, requireRole } from "../middleware/auth";
import { validate, validObjectId } from "../middleware/validate";
import { upload } from "../config/cloudinary";
import { customBoxSchema, curateCreateSchema, curateUpdateSchema } from "../validators/schemas";

const router = Router();
const staff = [protect, requireRole("admin", "vendor")];
const image = upload.single("image") as any;

router.get("/options", publicOptions);
router.post("/price", validate(customBoxSchema), priceBox);

router.get("/manage", ...staff, listOptions);
router.post("/manage", ...staff, image, validate(curateCreateSchema), createOption);
router.put("/manage/:id", ...staff, validObjectId("id", "option"), image, validate(curateUpdateSchema), updateOption);
router.delete("/manage/:id", ...staff, validObjectId("id", "option"), deleteOption);

export default router;
