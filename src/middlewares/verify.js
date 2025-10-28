import jwt from "jsonwebtoken";
import crypto from "crypto";

// Cấu hình cookie cho môi trường hiện tại
const COOKIE_SAMESITE = (process.env.COOKIE_SAMESITE || "lax").toLowerCase();
// secure nếu môi trường là production hoặc biến môi trường COOKIE_SECURE=true
const COOKIE_SECURE =
  process.env.COOKIE_SECURE === "true" || process.env.NODE_ENV === "production";

const CSRF_COOKIE_NAME = "csrfToken";
const CSRF_HEADER_NAME = "x-csrf-token";

// Tạo token CSRF ngẫu nhiên
export const createCsrfToken = () => crypto.randomBytes(32).toString("hex");

// Thiết lập cookie CSRF
export const setCsrfCookie = (res, token) => {
  res.cookie(CSRF_COOKIE_NAME, token, {
    httpOnly: false,
    sameSite: COOKIE_SAMESITE,
    secure: COOKIE_SECURE || COOKIE_SAMESITE === "none",
    path: "/",
  });
};

// Cấp phát token CSRF mới và gửi về client
export const issueCsrfToken = (req, res) => {
  const token = createCsrfToken();
  setCsrfCookie(res, token);
  return res.json({ success: true, csrfToken: token });
};

// Middleware xác thực token CSRF
export const verifyCsrf = (req, res, next) => {
  const method = (req.method || "GET").toUpperCase();
  const safeMethods = ["GET", "HEAD", "OPTIONS"];
  const method = (req.method || "GET").toUpperCase();
  const safeMethods = ["GET", "HEAD", "OPTIONS"];

  // Các phương thức an toàn không cần kiểm tra CSRF
  if (safeMethods.includes(method)) return next();

  // Lấy token từ cookie và header
  const cookieToken = req.cookies?.[CSRF_COOKIE_NAME];
  const headerToken = req.headers?.[CSRF_HEADER_NAME];

  // Nếu thiếu token hoặc không khớp, trả về lỗi
  if (!cookieToken || !headerToken || cookieToken !== headerToken) {
    return res.status(403).json({
      success: false,
      message: "Mã bảo vệ CSRF không khớp.",
    });
    return res.status(403).json({
      success: false,
      message: "Mã bảo vệ CSRF không khớp.",
    });
  }
  next();
};
  next();
};

// Middleware xác thực JWT
export const verifyJWT = (req, res, next) => {
  try {
    const token = req.cookies?.jwt;
    if (!token) {
      return res.status(401).json({
        success: false,
        message: "Phiên đăng nhập không hợp lệ hoặc đã hết hạn.",
      });
    }

    const secret = process.env.JWT_SECRET;
    if (!secret) throw new Error("JWT_SECRET chưa được cấu hình");

    const decoded = jwt.verify(token, secret);
    req.user = decoded;
    next();
    const token = req.cookies?.jwt;
    if (!token) {
      return res.status(401).json({
        success: false,
        message: "Phiên đăng nhập không hợp lệ hoặc đã hết hạn.",
      });
    }

    const secret = process.env.JWT_SECRET;
    if (!secret) throw new Error("JWT_SECRET chưa được cấu hình");

    const decoded = jwt.verify(token, secret);
    req.user = decoded;
    next();
  } catch (err) {
    return res.status(401).json({
      success: false,
      message: "Phiên đăng nhập đã hết hạn hoặc không hợp lệ.",
    });
    return res.status(401).json({
      success: false,
      message: "Phiên đăng nhập đã hết hạn hoặc không hợp lệ.",
    });
  }
};
};

// Middleware kiểm tra vai trò người dùng
export const requireRole = (role) => (req, res, next) => {
  const roles = req.user?.roles || [];
  const roles = req.user?.roles || [];
  if (!roles.includes(role)) {
    return res.status(403).json({
      success: false,
      message: "Không đủ quyền truy cập.",
    });
    return res.status(403).json({
      success: false,
      message: "Không đủ quyền truy cập.",
    });
  }
  next();
};
  next();
};

export const ALLOWED_ROLES = ["user", "editor", "admin"];
export const ALLOWED_ROLES = ["user", "editor", "admin"];
