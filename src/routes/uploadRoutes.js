import { Router } from "express";
import multer from "multer";
import { CloudinaryStorage } from "multer-storage-cloudinary";
import cloudinary from "../config/cloudinary.js"; // your config

const router = Router();

// ✅ Cloudinary storage
const storage = new CloudinaryStorage({
  cloudinary,
  params: {
    folder: "art_fashion_products",
    allowed_formats: ["jpg", "png", "jpeg", "webp"],
  },
});

const upload = multer({ storage });

router.post("/", upload.single("image"), (req, res) => {
  if (!req.file) {
    return res.status(400).json({ message: "No file uploaded" });
  }

  return res.status(201).json({
    image: req.file.path, // ✅ THIS IS CLOUDINARY URL
  });
});

export default router;
