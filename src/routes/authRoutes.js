import { Router } from "express";
import { requireAuth } from "../middleware/authMiddleware.js";
import {
  forgotPassword,
  getCurrentUser,
  loginUser,
  registerUser,
  resetPassword,
  resendVerificationEmail,
  verifyEmail,
  verifyPhoneOtp
} from "../controllers/authController.js";

const router = Router();

router.post("/register", registerUser);
router.post("/login", loginUser);
router.post("/verify-email", verifyEmail);
router.post("/verify-phone-otp", verifyPhoneOtp);
router.post("/resend-verification", resendVerificationEmail);
router.post("/forgot-password", forgotPassword);
router.post("/reset-password", resetPassword);
router.get("/me", requireAuth, getCurrentUser);

export default router;
