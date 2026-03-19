import { Router } from "express";
import {
  addOrUpdateProductReview,
  createProduct,
  deleteProduct,
  getAllProducts,
  getProductById,
  getFeaturedProducts,
  seedAllProducts,
  updateProduct
} from "../controllers/productController.js";
import { requireAuth } from "../middleware/authMiddleware.js";
import { upload } from "../config/cloudinary.js"; // Import your new Cloudinary middleware

const router = Router();

// Public Routes
router.get("/", getAllProducts);
router.get("/featured", getFeaturedProducts);
router.get("/:id", getProductById);

// Review Routes (Requires Login)
router.post("/:id/reviews", requireAuth, addOrUpdateProductReview);

// Admin/Management Routes
router.post("/seed", seedAllProducts);

// CREATE: Uses Cloudinary middleware for the "image" field
router.post("/", upload.single("image"), createProduct);

// UPDATE: Also allows updating the image via Cloudinary
router.put("/:id", upload.single("image"), updateProduct);

router.delete("/:id", deleteProduct);

export default router;