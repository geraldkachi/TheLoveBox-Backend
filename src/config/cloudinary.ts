import { v2 as cloudinary } from "cloudinary";
import { CloudinaryStorage } from "multer-storage-cloudinary";
import multer from "multer";
import { AppError } from "../utils/AppError";

cloudinary.config({
  cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
  api_key: process.env.CLOUDINARY_API_KEY,
  api_secret: process.env.CLOUDINARY_API_SECRET,
});

const IMAGE_TYPES = ["image/jpeg", "image/png", "image/webp", "image/jpg"];
const VIDEO_TYPES = ["video/mp4", "video/quicktime", "video/webm"];

const storage = new CloudinaryStorage({
  cloudinary,
  params: async (_req, file) => {
    const isVideo = file.mimetype.startsWith("video/");
    return {
      folder: isVideo ? "theloveboxgifts/products/videos" : "theloveboxgifts/products/images",
      resource_type: isVideo ? "video" : "image",
      allowed_formats: isVideo ? ["mp4", "mov", "webm"] : ["jpg", "jpeg", "png", "webp"],
      transformation: isVideo ? undefined : [{ width: 1600, crop: "limit", quality: "auto" }],
    };
  },
});

export const MAX_FILE_SIZE_MB = 40;
export const MAX_FILES = 8;

export const upload = multer({
  storage: storage as any,
  limits: { fileSize: MAX_FILE_SIZE_MB * 1024 * 1024, files: MAX_FILES },
  fileFilter: (_req, file, cb) => {
    if (IMAGE_TYPES.includes(file.mimetype) || VIDEO_TYPES.includes(file.mimetype)) return cb(null, true);
    cb(
      AppError.badRequest(
        `"${file.originalname}" isn't supported. Upload JPG, PNG or WEBP images, or MP4, MOV or WEBM videos.`
      ) as any
    );
  },
});

export { cloudinary };
