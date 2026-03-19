import bcrypt from "bcryptjs";
import crypto from "crypto";
import jwt from "jsonwebtoken";
import { User } from "../models/User.js";
import { sendResetPasswordEmail, sendVerificationEmail } from "../utils/email.js";

const createToken = (userId) =>
  jwt.sign({ userId }, process.env.JWT_SECRET || "lakminda_dev_secret", { expiresIn: "7d" });

const normalizeUser = (user) => ({
  id: user._id,
  name: user.name,
  email: user.email,
  isEmailVerified: Boolean(user.isEmailVerified)
});

const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

const assertPlainString = (value, fieldName) => {
  if (typeof value !== "string") {
    throw new Error(`${fieldName} must be a string`);
  }
  return value;
};

const sanitizeText = (value) =>
  String(value)
    .replace(/[<>]/g, "")
    .replace(/\0/g, "")
    .trim();

const normalizeEmailInput = (value) => sanitizeText(assertPlainString(value, "email")).toLowerCase();

const createEmailVerificationToken = () => {
  const rawToken = crypto.randomBytes(32).toString("hex");
  const tokenHash = crypto.createHash("sha256").update(rawToken).digest("hex");
  const expiresAt = new Date(Date.now() + 24 * 60 * 60 * 1000);
  return { rawToken, tokenHash, expiresAt };
};

const createResetPasswordToken = () => {
  const rawToken = crypto.randomBytes(32).toString("hex");
  const tokenHash = crypto.createHash("sha256").update(rawToken).digest("hex");
  const expiresAt = new Date(Date.now() + 60 * 60 * 1000);
  return { rawToken, tokenHash, expiresAt };
};

const buildClientBaseUrl = () => process.env.CLIENT_URL || "http://localhost:5173";

const sendUserVerification = async (user) => {
  const { rawToken, tokenHash, expiresAt } = createEmailVerificationToken();
  user.emailVerificationTokenHash = tokenHash;
  user.emailVerificationExpiresAt = expiresAt;
  await user.save();

  const verificationUrl = `${buildClientBaseUrl()}/verify-email?token=${rawToken}&email=${encodeURIComponent(user.email)}`;
  await sendVerificationEmail({
    to: user.email,
    name: user.name,
    verificationUrl
  });
};

const sendUserResetPassword = async (user) => {
  const { rawToken, tokenHash, expiresAt } = createResetPasswordToken();
  user.resetPasswordTokenHash = tokenHash;
  user.resetPasswordExpiresAt = expiresAt;
  await user.save();

  const resetUrl = `${buildClientBaseUrl()}/reset-password?token=${rawToken}&email=${encodeURIComponent(user.email)}`;
  await sendResetPasswordEmail({
    to: user.email,
    name: user.name,
    resetUrl
  });
};

export const registerUser = async (req, res) => {
  try {
 const name = String(req.body.name || "").trim();
const email = String(req.body.email || "").trim().toLowerCase();
const phone = String(req.body.phone || "").trim();
const password = String(req.body.password || "").trim();

    if (!name || !email || !phone || !password) {
      return res.status(400).json({
        message: "Name, email, phone and password are required"
      });
    }

    const normalizedEmail = email.trim().toLowerCase();

    // check duplicate email
    const existingEmail = await User.findOne({ email: normalizedEmail });
    if (existingEmail) {
      return res.status(409).json({ message: "Email already registered" });
    }

    // check duplicate phone
    const existingPhone = await User.findOne({ phone });
    if (existingPhone) {
      return res.status(409).json({ message: "Phone already registered" });
    }

    const passwordHash = await bcrypt.hash(password, 10);

    await User.create({
      name,
      email: normalizedEmail,
      phone,
      passwordHash
    });

    res.status(201).json({ message: "Registered successfully" });

  } catch (error) {
    console.error("🔥 REGISTER ERROR:", error);
    return res.status(500).json({ message: error.message });
  }
};

export const verifyPhoneOtp = async (req, res) => {
  try {
    const { phone, otp } = req.body;

    const user = await User.findOne({ phone });

    if (!user) {
      return res.status(404).json({ message: "User not found" });
    }

    if (user.phoneOtp !== otp) {
      return res.status(400).json({ message: "Invalid OTP" });
    }

    if (user.otpExpires < Date.now()) {
      return res.status(400).json({ message: "OTP expired" });
    }

    user.isPhoneVerified = true;
    user.phoneOtp = "";
    await user.save();

    res.json({ message: "Phone verified successfully" });

  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

export const loginUser = async (req, res) => {
  try {
    const phone = String(req.body.phone || "").trim();
const password = String(req.body.password || "").trim();

    if (!phone || !password) {
      return res.status(400).json({ message: "Phone and password are required" });
    }

    const cleanPassword = String(password).trim();

    // 🔍 Find user by phone
    const user = await User.findOne({ phone });
    if (!user) {
      return res.status(401).json({ message: "Invalid phone or password" });
    }

    // 🔑 Check password
    const isValidPassword = await bcrypt.compare(cleanPassword, user.passwordHash);
    if (!isValidPassword) {
      return res.status(401).json({ message: "Invalid phone or password" });
    }

    // 🎫 Create token
    const token = createToken(user._id);

    return res.status(200).json({
      message: "Login successful",
      token,
      user: {
        id: user._id,
        name: user.name,
        phone: user.phone
      }
    });

  } catch (error) {
    return res.status(500).json({
      message: "Failed to login user",
      error: error.message
    });
  }
};

export const getCurrentUser = async (req, res) => {
  try {
    const user = await User.findById(req.user.userId).select("-passwordHash");
    if (!user) {
      return res.status(404).json({ message: "User not found" });
    }
    return res.status(200).json({ user });
  } catch (error) {
    return res.status(500).json({ message: "Failed to get current user", error: error.message });
  }
};

export const verifyEmail = async (req, res) => {
  try {
    const { token } = req.body || {};
    if (!token) {
      return res.status(400).json({ message: "Verification token is required" });
    }

    const rawToken = sanitizeText(assertPlainString(token, "token")).toLowerCase();
    if (!/^[a-f0-9]{64}$/.test(rawToken)) {
      return res.status(400).json({ message: "Invalid verification token format" });
    }

    const tokenHash = crypto.createHash("sha256").update(rawToken).digest("hex");
    const user = await User.findOne({
      emailVerificationTokenHash: tokenHash,
      emailVerificationExpiresAt: { $gt: new Date() }
    });

    if (!user) {
      return res.status(400).json({ message: "Invalid or expired verification token" });
    }

    user.isEmailVerified = true;
    user.emailVerificationTokenHash = "";
    user.emailVerificationExpiresAt = null;
    await user.save();

    return res.status(200).json({ message: "Email verified successfully. You can now log in." });
  } catch (error) {
    return res.status(500).json({ message: "Failed to verify email", error: error.message });
  }
};

export const resendVerificationEmail = async (req, res) => {
  try {
    const { email } = req.body || {};
    if (!email) {
      return res.status(400).json({ message: "Email is required" });
    }

    const normalizedEmail = normalizeEmailInput(email);
    if (!EMAIL_REGEX.test(normalizedEmail)) {
      return res.status(400).json({ message: "Invalid email format" });
    }

    const user = await User.findOne({ email: normalizedEmail });
    if (!user) {
      return res.status(404).json({ message: "User not found" });
    }

    if (user.isEmailVerified) {
      return res.status(400).json({ message: "Email is already verified" });
    }

    await sendUserVerification(user);
    return res.status(200).json({ message: "Verification email sent" });
  } catch (error) {
    return res.status(500).json({ message: "Failed to resend verification email", error: error.message });
  }
};

export const forgotPassword = async (req, res) => {
  try {

    const { phone } = req.body;

    if (!phone) {
      return res.status(400).json({ message: "Phone number is required" });
    }

    const user = await User.findOne({ phone });

    if (!user) {
      return res.status(404).json({ message: "User not found" });
    }

    // Generate OTP
    const otp = Math.floor(100000 + Math.random() * 900000);

    user.resetOtp = otp;
    user.resetOtpExpires = Date.now() + 10 * 60 * 1000; // 10 minutes

    await user.save();

    // For now show OTP in server terminal
    console.log("RESET PASSWORD OTP:", otp);

    return res.status(200).json({
      message: "OTP sent to your phone"
    });

  } catch (error) {
    return res.status(500).json({
      message: "Failed to process forgot password",
      error: error.message
    });
  }
};

export const resetPassword = async (req, res) => {
  try {
    const { token, newPassword } = req.body || {};
    if (!token || !newPassword) {
      return res.status(400).json({ message: "token and newPassword are required" });
    }

    const rawToken = sanitizeText(assertPlainString(token, "token")).toLowerCase();
    if (!/^[a-f0-9]{64}$/.test(rawToken)) {
      return res.status(400).json({ message: "Invalid reset token format" });
    }

    const cleanPassword = assertPlainString(newPassword, "newPassword");
    if (cleanPassword.length < 6) {
      return res.status(400).json({ message: "Password must be at least 6 characters" });
    }

    const tokenHash = crypto.createHash("sha256").update(rawToken).digest("hex");
    const user = await User.findOne({
      resetPasswordTokenHash: tokenHash,
      resetPasswordExpiresAt: { $gt: new Date() }
    });

    if (!user) {
      return res.status(400).json({ message: "Invalid or expired reset token" });
    }

    user.passwordHash = await bcrypt.hash(cleanPassword, 10);
    user.resetPasswordTokenHash = "";
    user.resetPasswordExpiresAt = null;
    await user.save();

    return res.status(200).json({ message: "Password reset successful. You can now log in." });
  } catch (error) {
    return res.status(500).json({ message: "Failed to reset password", error: error.message });
  }
};
