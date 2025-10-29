import jwt from "jsonwebtoken";
import crypto from "crypto";

const COOKIE_SAMESITE = (process.env.COOKIE_SAMESITE || "lax").toLowerCase();
const COOKIE_SECURE =
  process.env.COOKIE_SECURE === "true" || process.env.NODE_ENV === "production";

const CSRF_COOKIE_NAME = "csrfToken";
const CSRF_HEADER_NAME = "x-csrf-token";
const SAFE_METHODS = new Set(["GET", "HEAD", "OPTIONS"]);

export const createCsrfToken = () => crypto.randomBytes(32).toString("hex");

export const setCsrfCookie = (res, token) => {
  res.cookie(CSRF_COOKIE_NAME, token, {
    httpOnly: false,
    sameSite: COOKIE_SAMESITE,
    secure: COOKIE_SECURE || COOKIE_SAMESITE === "none",
    path: "/",
  });
};

export const issueCsrfToken = (req, res) => {
  const token = createCsrfToken();
  setCsrfCookie(res, token);
  return res.json({ success: true, csrfToken: token });
};

export const verifyCsrf = (req, res, next) => {
  const method = (req.method || "GET").toUpperCase();
  if (SAFE_METHODS.has(method)) return next();

  const cookieToken = req.cookies?.[CSRF_COOKIE_NAME];
  const headerToken = req.headers?.[CSRF_HEADER_NAME];

  if (!cookieToken || !headerToken || cookieToken !== headerToken) {
    return res.status(403).json({
      success: false,
      message: "CSRF token khong hop le.",
    });
  }

  return next();
};

export const verifyJWT = (req, res, next) => {
  try {
    const token = req.cookies?.jwt;
    if (!token) {
      return res.status(401).json({
        success: false,
        message: "Phien dang nhap khong hop le hoac da het han.",
      });
    }

    const secret = process.env.JWT_SECRET;
    if (!secret) {
      throw new Error("JWT_SECRET chua duoc cau hinh");
    }

    const decoded = jwt.verify(token, secret);
    req.user = decoded;
    return next();
  } catch (error) {
    console.error("verifyJWT error:", error);
    return res.status(401).json({
      success: false,
      message: "Phien dang nhap khong hop le.",
    });
  }
};

export const requireRole = (role) => (req, res, next) => {
  const roles = req.user?.roles || [];
  if (!roles.includes(role)) {
    return res.status(403).json({
      success: false,
      message: "Khong du quyen truy cap.",
    });
  }
  return next();
};

export const ALLOWED_ROLES = ["user", "editor", "admin"];

