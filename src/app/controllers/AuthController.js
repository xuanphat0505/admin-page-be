import bcrypt from "bcrypt";
import jwt from "jsonwebtoken";
import UserModel from "../models/UserModel.js";
import { createCsrfToken, setCsrfCookie } from "../../middlewares/verify.js";

const COOKIE_SAMESITE = (process.env.COOKIE_SAMESITE || "lax").toLowerCase();
const COOKIE_SECURE =
  process.env.COOKIE_SECURE === "true" || process.env.NODE_ENV === "production";
const JWT_MAX_AGE_MS = Number(process.env.JWT_MAX_AGE_MS || 24 * 60 * 60 * 1000);

const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const MAX_DISPLAY_NAME = 64;
const MIN_PASSWORD_LENGTH = 6;

const serverError = (res, label, error) => {
  console.error(label, error);
  return res.status(500).json({ success: false, message: "Loi he thong." });
};

const setJwtCookie = (res, token, maxAgeMs) => {
  res.cookie("jwt", token, {
    httpOnly: true,
    sameSite: COOKIE_SAMESITE,
    secure: COOKIE_SECURE || COOKIE_SAMESITE === "none",
    maxAge: maxAgeMs,
    path: "/",
  });
};

const normalizeRegisterPayload = ({ username, email, password, name } = {}) => ({
  username: (username || "").trim(),
  email: (email || "").trim().toLowerCase(),
  password: password || "",
  name: (name || "").trim(),
});

export const register = async (req, res) => {
  try {
    const { username, email, password, name } = normalizeRegisterPayload(req.body);

    if (!username || !email || !password || !name) {
      return res
        .status(400)
        .json({ success: false, message: "Thieu thong tin bat buoc." });
    }

    if (!EMAIL_REGEX.test(email)) {
      return res
        .status(400)
        .json({ success: false, message: "Email khong hop le." });
    }

    if (password.length < MIN_PASSWORD_LENGTH) {
      return res
        .status(400)
        .json({ success: false, message: "Mat khau phai co it nhat 6 ky tu." });
    }

    if (name.length > MAX_DISPLAY_NAME) {
      return res
        .status(400)
        .json({ success: false, message: "Ten hien thi khong duoc vuot qua 64 ky tu." });
    }

    const [emailExists, usernameExists, nameExists] = await Promise.all([
      UserModel.findOne({ email }),
      UserModel.findOne({ username }),
      UserModel.findOne({ name }),
    ]);

    if (emailExists) {
      return res
        .status(409)
        .json({ success: false, message: "Email da duoc su dung." });
    }

    if (usernameExists) {
      return res
        .status(409)
        .json({ success: false, message: "Ten dang nhap da duoc su dung." });
    }

    if (nameExists) {
      return res
        .status(409)
        .json({ success: false, message: "Ten hien thi da duoc su dung." });
    }

    const hashedPassword = await bcrypt.hash(password, 10);

    const newUser = new UserModel({
      name,
      username,
      email,
      password: hashedPassword,
      roles: ["user"],
    });

    await newUser.save();

    return res.status(201).json({
      success: true,
      message: "Dang ky thanh cong",
      data: {
        id: newUser._id,
        name: newUser.name,
        username: newUser.username,
        email: newUser.email,
        roles: newUser.roles,
      },
    });
  } catch (error) {
    return serverError(res, "Loi dang ky:", error);
  }
};

export const login = async (req, res) => {
  try {
    const userInput = (req.body?.user || "").trim();
    const passwordInput = req.body?.pwd || "";
    const emailInput = userInput.toLowerCase();

    if (!userInput || !passwordInput) {
      return res
        .status(400)
        .json({ success: false, message: "Thieu ten dang nhap hoac mat khau." });
    }

    const foundUser = await UserModel.findOne({
      $or: [{ username: userInput }, { email: emailInput }],
      isActive: true,
      isDeleted: false,
    }).select("+password");

    if (!foundUser) {
      return res
        .status(401)
        .json({ success: false, message: "Khong tim thay tai khoan." });
    }

    const isPasswordValid = await bcrypt.compare(passwordInput, foundUser.password);
    if (!isPasswordValid) {
      return res
        .status(401)
        .json({ success: false, message: "Mat khau khong chinh xac." });
    }

    const secret = process.env.JWT_SECRET;
    if (!secret) {
      throw new Error("JWT_SECRET chua duoc cau hinh");
    }

    const accessToken = jwt.sign(
      { userId: foundUser._id, username: foundUser.username, roles: foundUser.roles },
      secret,
      { expiresIn: Math.floor(JWT_MAX_AGE_MS / 1000) },
    );

    setJwtCookie(res, accessToken, JWT_MAX_AGE_MS);

    const csrf = createCsrfToken();
    setCsrfCookie(res, csrf);

    return res.json({
      success: true,
      message: "Dang nhap thanh cong",
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
    return serverError(res, "Loi dang nhap:", error);
  }
};

export const logout = async (req, res) => {
  try {
    res.clearCookie("jwt", {
      httpOnly: true,
      sameSite: COOKIE_SAMESITE,
      secure: COOKIE_SECURE || COOKIE_SAMESITE === "none",
      path: "/",
    });

    res.clearCookie("csrfToken", {
      httpOnly: false,
      sameSite: COOKIE_SAMESITE,
      secure: COOKIE_SECURE || COOKIE_SAMESITE === "none",
      path: "/",
    });

    return res.json({ success: true, message: "Dang xuat thanh cong" });
  } catch (error) {
    return serverError(res, "Loi dang xuat:", error);
  }
};

export const heartbeat = async (req, res) => {
  try {
    const secret = process.env.JWT_SECRET;
    if (!secret) {
      throw new Error("JWT_SECRET chua duoc cau hinh");
    }

    const { userId, username, roles } = req.user || {};
    if (!userId) {
      return res
        .status(401)
        .json({ success: false, message: "Phien dang nhap khong con hieu luc." });
    }

    const accessToken = jwt.sign(
      { userId, username, roles },
      secret,
      { expiresIn: Math.floor(JWT_MAX_AGE_MS / 1000) },
    );

    setJwtCookie(res, accessToken, JWT_MAX_AGE_MS);

    return res.json({ success: true });
  } catch (error) {
    return serverError(res, "Loi heartbeat:", error);
  }
};

export const csrfToken = (req, res) => {
  const token = createCsrfToken();
  setCsrfCookie(res, token);
  return res.json({ success: true, csrfToken: token });
};

