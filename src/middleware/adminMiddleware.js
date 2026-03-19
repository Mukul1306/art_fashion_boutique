export const requireAdminAccess = (req, res, next) => {
  const adminKey = req.headers["x-admin-key"];

  if (adminKey !== "art@2026#Admin!Secure9") {
    return res.status(403).json({ message: "Admin access denied" });
  }

  next();
};