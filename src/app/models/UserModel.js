import mongoose from "mongoose"

// Mô hình (schema) người dùng
// - Chuẩn hóa và ràng buộc dữ liệu ở mức DB (trim/lowercase)
// - Ẩn mật khẩu khỏi kết quả truy vấn mặc định (select: false)
// - Thêm giới hạn/định dạng cho username, email
const userSchema = new mongoose.Schema({
    // Tên đăng nhập: bắt buộc, duy nhất, loại khoảng trắng hai đầu
    username: {
        type: String,
        required: true,
        unique: true,
        trim: true,
        minlength: 3,
        maxlength: 32,
        match: [/^[a-zA-Z0-9_.-]+$/, 'username chỉ gồm chữ/số/._-'],
    },
    // Email: bắt buộc, duy nhất, lưu dạng chữ thường 
    email: {
        type: String,
        required: true,
        unique: true,
        trim: true,
        lowercase: true,
        match: [/^[^\s@]+@[^\s@]+\.[^\s@]+$/, 'email không hợp lệ'],
    },

    // Mật khẩu (đã băm): luôn ẩn khỏi truy vấn mặc định, chỉ lấy khi .select('+password')
    password: { type: String, required: true, select: false },

    // Vai trò: chỉ chấp nhận trong tập cho trước, mặc định là 'user'
    roles: { type: [String], enum: ['user', 'editor', 'admin'], default: ["user"] },

    // Trạng thái hoạt động/xóa 
    isActive: { type: Boolean, default: true },
    isDeleted: { type: Boolean, default: false },
    createdAt: { type: Date, default: Date.now },
    updatedAt: { type: Date, default: Date.now },
    deletedAt: { type: Date, default: null },
})

// Truy vấn: chỉ lấy người dùng chưa xóa
userSchema.query.notDeleted = function () {
    return this.where({ isDeleted: false })
}

// Cập nhật thời gian cập nhật trước khi lưu
userSchema.pre('save', function (next) {
    this.updatedAt = new Date()
    next()
})

// Loại bỏ các trường nhạy cảm/thừa khi chuyển sang JSON/Object
const clean = (doc, ret) => {
    delete ret.password
    delete ret.__v
    return ret
}
userSchema.set('toJSON', { transform: clean })
userSchema.set('toObject', { transform: clean })

const UserModel = mongoose.model("user", userSchema)

export default UserModel
