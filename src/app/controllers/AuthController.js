import bcrypt from "bcrypt";
import jwt from "jsonwebtoken";
import UserModel from "../models/UserModel.js";
import { createCsrfToken, setCsrfCookie } from "../../middlewares/verify.js";

// Cấu hình cookie cho môi trường hiện tại
const COOKIE_SAMESITE = (process.env.COOKIE_SAMESITE || "lax").toLowerCase();
const COOKIE_SECURE =
  process.env.COOKIE_SECURE === "true" || process.env.NODE_ENV === "production";

// Thiết lập cookie JWT
const setJwtCookie = (res, token, maxAgeMs) => {
  res.cookie("jwt", token, {
    httpOnly: true,
    sameSite: COOKIE_SAMESITE,
    secure: COOKIE_SECURE || COOKIE_SAMESITE === "none", // Luôn secure nếu SameSite=None
    maxAge: maxAgeMs, // 1 ngày
    path: "/",
  });
};

// Đăng ký tài khoản mới
export const register = async (req, res) => {
  try {
    const { username, email, password, name } = req.body;
    const normalizedEmail = (email || "").trim().toLowerCase();
    const normalizedUsername = (username || "").trim();
    const normalizedName = (name || "").trim();

    if (!normalizedUsername || !normalizedEmail || !password || !normalizedName) {
      return res
        .status(400)
        .json({ success: false, message: "Thiếu thông tin bắt buộc." });
    }

    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(normalizedEmail)) {
      return res.status(400).json({ success: false, message: "Email không hợp lệ." });
    }

    if (password.length < 6) {
      return res
        .status(400)
        .json({ success: false, message: "Mật khẩu phải có ít nhất 6 ký tự." });
    }

    if (normalizedName.length > 64) {
      return res
        .status(400)
        .json({ success: false, message: "Tên hiển thị không được vượt quá 64 ký tự." });
    }

    const emailExists = await UserModel.findOne({ email: normalizedEmail });
    if (emailExists) {
      return res.status(409).json({ success: false, message: "Email đã được sử dụng." });
    }

    const usernameExists = await UserModel.findOne({ username: normalizedUsername });
    if (usernameExists) {
      return res
        .status(409)
        .json({ success: false, message: "Tên đăng nhập đã được sử dụng." });
    }

    const nameExists = await UserModel.findOne({ name: normalizedName });
    if (nameExists) {
      return res
        .status(409)
        .json({ success: false, message: "Tên hiển thị đã được sử dụng." });
    }

    // Mã hóa mật khẩu
    const hashedPassword = await bcrypt.hash(password, 10);

    // Tạo user mới với vai trò "user"
    const newUser = new UserModel({
      name: normalizedName,
      username: normalizedUsername,
      email: normalizedEmail,
      password: hashedPassword,
      roles: ["user"],
    });
    await newUser.save();

    return res.status(201).json({
      success: true,
      message: "Đăng ký thành công",
      data: {
        id: newUser._id,
        name: newUser.name,
        username: newUser.username,
        email: newUser.email,
        roles: newUser.roles,
      },
    });
  } catch (error) {
    console.error("Lỗi đăng ký:", error);
    return res.status(500).json({ success: false, message: "Lỗi hệ thống." });
  }
};

// Đăng nhập: trả JWT qua cookie HttpOnly và cấp CSRF token
export const login = async (req, res) => {
  try {
    const { user, pwd } = req.body;
    const userInput = (user || "").trim();
    const emailInput = userInput.toLowerCase();

    if (!userInput || !pwd) {
      return res
        .status(400)
        .json({ success: false, message: "Thiếu tên đăng nhập hoặc mật khẩu." });
    }

    // Tìm user theo username hoặc email
    const foundUser = await UserModel.findOne({
      $or: [{ username: userInput }, { email: emailInput }],
      isActive: true,
      isDeleted: false,
    }).select("+password");

    if (!foundUser) {
      return res.status(401).json({ success: false, message: "Không tìm thấy tài khoản." });
    }

    const isPasswordValid = await bcrypt.compare(pwd, foundUser.password);
    if (!isPasswordValid) {
      return res.status(401).json({ success: false, message: "Mật khẩu không chính xác." });
    }

    // Tạo JWT
    const secret = process.env.JWT_SECRET;
    if (!secret) throw new Error("JWT_SECRET chưa được cấu hình");

    // JWT hết hạn sau 1 ngày
    const maxAgeMs = 24 * 60 * 60 * 1000;

    // Tạo token với thông tin userId, username, roles
    const accessToken = jwt.sign(
      { userId: foundUser._id, username: foundUser.username, roles: foundUser.roles },
      secret,
      { expiresIn: Math.floor(maxAgeMs / 1000) },
    );

    setJwtCookie(res, accessToken, maxAgeMs);

    const csrf = createCsrfToken();
    setCsrfCookie(res, csrf);

    return res.json({
      success: true,
      message: "Đăng nhập thành công",
      data: {
        user: {
          id: foundUser._id,
          name: foundUser.name,
          username: foundUser.username,
          email: foundUser.email,
          roles: foundUser.roles,
        },
      },
    });
  } catch (error) {
    console.error("Lỗi đăng nhập:", error);
    return res.status(500).json({ success: false, message: "Lỗi hệ thống." });
  }
};

// Đăng xuất: xóa cookie JWT và CSRF
export const logout = async (req, res) => {
  try {
    // Xóa cookie bằng cách đặt lại với maxAge=0
    res.clearCookie("jwt", {
      httpOnly: true,
      sameSite: COOKIE_SAMESITE,
      secure: COOKIE_SECURE || COOKIE_SAMESITE === "none",
      path: "/",
    });
    // Xóa cookie CSRF
    res.clearCookie("csrfToken", {
      httpOnly: false,
      sameSite: COOKIE_SAMESITE,
      secure: COOKIE_SECURE || COOKIE_SAMESITE === "none",
      path: "/",
    });
    return res.json({ success: true, message: "Đăng xuất thành công" });
  } catch (error) {
    console.error("Lỗi đăng xuất:", error);
    return res.status(500).json({ success: false, message: "Không thể đăng xuất." });
  }
};

// Heartbeat: gia hạn cookie JWT
export const heartbeat = async (req, res) => {
  try {
    const secret = process.env.JWT_SECRET;
    if (!secret) throw new Error("JWT_SECRET chưa được cấu hình");

    const { userId, username, roles } = req.user || {};
    if (!userId) {
      return res
        .status(401)
        .json({ success: false, message: "Phiên đăng nhập không còn hiệu lực." });
    }

    const maxAgeMs = 24 * 60 * 60 * 1000;
    // Tạo token với thông tin userId, username, roles
    const accessToken = jwt.sign(
      { userId, username, roles },
      secret,
      { expiresIn: Math.floor(maxAgeMs / 1000) },
    );
    setJwtCookie(res, accessToken, maxAgeMs);
    return res.json({ success: true });
  } catch (error) {
    console.error("Lỗi heartbeat:", error);
    return res.status(500).json({ success: false, message: "Lỗi hệ thống." });
  }
};

// Cấp token CSRF cho frontend
export const csrfToken = (req, res) => {
  const token = createCsrfToken();
  setCsrfCookie(res, token);
  return res.json({ success: true, csrfToken: token });
};
