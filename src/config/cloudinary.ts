import { v2 as cloudinary } from "cloudinary";
import { CloudinaryStorage } from "multer-storage-cloudinary";
import multer from "multer";

cloudinary.config({
  cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
  api_key: process.env.CLOUDINARY_API_KEY,
  api_secret: process.env.CLOUDINARY_API_SECRET,
});

const storage = new CloudinaryStorage({
  cloudinary,
  params: async (req, file) => {
    const isVideo = file.mimetype.startsWith("video/");
    return {
      folder: isVideo ? "theloveboxgifts/products/videos" : "theloveboxgifts/products/images",
      resource_type: isVideo ? "video" : "image",
      allowed_formats: isVideo ? ["mp4", "mov", "webm"] : ["jpg", "jpeg", "png", "webp"],
      transformation: isVideo ? undefined : [{ width: 1600, crop: "limit", quality: "auto" }],
    };
  },
});

const MAX_FILE_SIZE = 40 * 1024 * 1024; // 40MB, covers short product videos

export const upload = multer({
  // storage: createStorage() as multer.StorageEngine,
  storage: storage as any,
  limits: { fileSize: MAX_FILE_SIZE },
  // fileFilter: (req, file, cb) => {
  //   const ok = file.mimetype.startsWith("image/") || file.mimetype.startsWith("video/");
  //   cb(ok ? null : new Error("Only image or video files are allowed."), ok);
  // },
  fileFilter: (req, file, cb) => {
    if (file.mimetype.startsWith("image/") || file.mimetype.startsWith("video/")) {
      cb(null, true);
    } else {
      cb(new Error("Only image or video files are allowed.") as any, false);
    }
  },
});
export { cloudinary };
