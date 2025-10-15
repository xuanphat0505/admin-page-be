import bcrypt from "bcrypt";
import UserModel from "../models/UserModel.js";

// Lấy danh sách người dùng đang hoạt động (chưa bị đánh dấu xóa)
export const getAllUsers = async (req, res) => {
  try {
    const requester = req.user || {};
    if (!requester.roles?.includes("admin")) {
      return res.status(403).json({ success: false, message: "Không đủ quyền." });
    }

    const users = await UserModel.find({ isDeleted: false }).select("-password");
    return res.json({ success: true, data: users });
  } catch (error) {
    console.error("Lỗi lấy danh sách người dùng:", error);
    return res.status(500).json({ success: false, message: "Lỗi hệ thống." });
  }
};

// Lấy chi tiết một người dùng (chưa bị đánh dấu xóa)
export const getUserById = async (req, res) => {
  try {
    const requester = req.user || {};
    if (!requester.roles?.includes("admin")) {
      return res.status(403).json({ success: false, message: "Không đủ quyền." });
    }

    const { id } = req.params;
    const user = await UserModel.findOne({ _id: id, isDeleted: false }).select("-password");
    if (!user) {
      return res.status(404).json({ success: false, message: "Không tìm thấy người dùng." });
    }
    return res.json({ success: true, data: user });
  } catch (error) {
    console.error("Lỗi lấy người dùng theo ID:", error);
    return res.status(500).json({ success: false, message: "Lỗi hệ thống." });
  }
};

// Cập nhật thông tin người dùng; chỉ admin được phép thao tác
export const updateUser = async (req, res) => {
  const requester = req.user || {};
  if (!requester.roles?.includes("admin")) {
    return res.status(403).json({ success: false, message: "Không đủ quyền." });
  }

  try {
    const { id } = req.params;
    const { username, roles, isActive } = req.body;
    const rawEmail = req.body.newEmail ?? req.body.email;
    const nextEmail = rawEmail?.trim().toLowerCase();

    const user = await UserModel.findById(id);
    if (!user) {
      return res.status(404).json({ success: false, message: "Không tìm thấy người dùng." });
    }

    if (nextEmail && nextEmail !== (user.email || "").trim().toLowerCase()) {
      const emailExists = await UserModel.exists({ email: nextEmail, _id: { $ne: id } });
      if (emailExists) {
        return res.status(409).json({ success: false, message: "Email đã được sử dụng." });
      }
      user.email = nextEmail;
    }

    if (typeof username === "string" && username.trim()) {
      user.username = username.trim();
    }

    if (typeof req.body.name === "string") {
      const trimmedName = req.body.name.trim();
      if (!trimmedName) {
        return res.status(400).json({ success: false, message: "Tên không được để trống." });
      }
      if (trimmedName.length > 64) {
        return res
          .status(400)
          .json({ success: false, message: "Tên hiển thị không được vượt quá 64 ký tự." });
      }
      if (trimmedName !== user.name) {
        const nameExists = await UserModel.exists({ name: trimmedName, _id: { $ne: id } });
        if (nameExists) {
          return res.status(409).json({ success: false, message: "Tên hiển thị đã được sử dụng." });
        }
      }
      user.name = trimmedName;
    }

    if (roles) {
      const allowedRoles = ["user", "editor", "admin"];
      const valid =
        Array.isArray(roles) && roles.length > 0 && roles.every((role) => allowedRoles.includes(role));
      if (!valid) {
        return res.status(400).json({ success: false, message: "Danh sách vai trò không hợp lệ." });
      }
      user.roles = roles;
    }

    if (typeof isActive === "boolean") {
      user.isActive = isActive;
    }

    user.updatedAt = new Date();
    await user.save();

    return res.json({
      success: true,
      message: "Cập nhật người dùng thành công",
      data: {
        id: user._id,
        name: user.name,
        username: user.username,
        email: user.email,
        roles: user.roles,
        isActive: user.isActive,
      },
    });
  } catch (error) {
    console.error("Lỗi cập nhật người dùng:", error);
    return res.status(500).json({ success: false, message: "Lỗi hệ thống." });
  }
};

// Đánh dấu xóa người dùng (không xóa vật lý khỏi cơ sở dữ liệu)
export const deleteUser = async (req, res) => {
  try {
    const requester = req.user || {};
    if (!requester.roles?.includes("admin")) {
      return res.status(403).json({ success: false, message: "Không đủ quyền." });
    }

    const { id } = req.params;
    const user = await UserModel.findById(id);
    if (!user) {
      return res.status(404).json({ success: false, message: "Không tìm thấy người dùng." });
    }

    user.isDeleted = true;
    user.deletedAt = new Date();
    await user.save();
    return res.json({ success: true, message: "Xóa người dùng thành công" });
  } catch (error) {
    console.error("Lỗi xóa người dùng:", error);
    return res.status(500).json({ success: false, message: "Lỗi hệ thống." });
  }
};

// Đổi mật khẩu: cho phép chính chủ hoặc admin
export const changePassword = async (req, res) => {
  try {
    const { id } = req.params;
    const { currentPassword, newPassword } = req.body;

    if (!currentPassword || !newPassword) {
      return res
        .status(400)
        .json({ success: false, message: "Thiếu mật khẩu hiện tại hoặc mật khẩu mới." });
    }
    if (newPassword.length < 6) {
      return res
        .status(400)
        .json({ success: false, message: "Mật khẩu mới phải có ít nhất 6 ký tự." });
    }

    const requester = req.user || {};
    const isAdmin = requester.roles?.includes("admin");
    if (!isAdmin && requester.userId !== id) {
      return res.status(403).json({ success: false, message: "Không đủ quyền." });
    }

    const user = await UserModel.findById(id).select("+password");
    if (!user) {
      return res.status(404).json({ success: false, message: "Không tìm thấy người dùng." });
    }

    if (!isAdmin) {
      const isCurrentPasswordValid = await bcrypt.compare(currentPassword, user.password);
      if (!isCurrentPasswordValid) {
        return res
          .status(400)
          .json({ success: false, message: "Mật khẩu hiện tại không chính xác." });
      }
    }

    const hashedNewPassword = await bcrypt.hash(newPassword, 10);
    user.password = hashedNewPassword;
    user.updatedAt = new Date();
    await user.save();

    return res.json({ success: true, message: "Đổi mật khẩu thành công" });
  } catch (error) {
    console.error("Lỗi đổi mật khẩu:", error);
    return res.status(500).json({ success: false, message: "Lỗi hệ thống." });
  }
};
