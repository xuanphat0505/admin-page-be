import bcrypt from 'bcrypt'
import jwt from 'jsonwebtoken'
import UserModel from '../models/UserModel.js'
import { createCsrfToken, setCsrfCookie } from '../../middlewares/verify.js'

// Cấu hình cookie cho môi trường hiện tại
const COOKIE_SAMESITE = (process.env.COOKIE_SAMESITE || 'lax').toLowerCase()
const COOKIE_SECURE = process.env.COOKIE_SECURE === 'true' || process.env.NODE_ENV === 'production'

// Helper đặt cookie JWT
const setJwtCookie = (res, token, maxAgeMs) => {
  res.cookie('jwt', token, {
    httpOnly: true,
    sameSite: COOKIE_SAMESITE,        
    secure: COOKIE_SECURE || COOKIE_SAMESITE === 'none',
    maxAge: maxAgeMs,
    path: '/',
  })
}

// Đăng ký tài khoản mới
export const register = async (req, res) => {
  try {
    const { username, email, password, name } = req.body
    const normalizedEmail = (email || '').trim().toLowerCase()
    const normalizedUsername = (username || '').trim()
    const normalizedName = (name || '').trim()

    if (!normalizedUsername || !normalizedEmail || !password || !normalizedName) {
      return res.status(400).json({ success: false, message: 'Thiếu thông tin bắt buộc' })
    }

    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
    if (!emailRegex.test(normalizedEmail)) {
      return res.status(400).json({ success: false, message: 'Email không hợp lệ' })
    }

    if (password.length < 6) {
      return res.status(400).json({ success: false, message: 'Mật khẩu tối thiểu 6 ký tự' })
    }

    if (normalizedName.length > 64) {
      return res.status(400).json({ success: false, message: 'Tên không được quá 64 ký tự' })
    }

    // Ki?m tra tr�ng l?p username ho?c email
    const emailExists = await UserModel.findOne({ email: normalizedEmail })
    if (emailExists) return res.status(409).json({ success: false, message: 'Email đã tồn tại' })

    //Ki?m tra tr�ng l?p username ho?c email
    const usernameExists = await UserModel.findOne({ username: normalizedUsername })
    if (usernameExists) return res.status(409).json({ success: false, message: 'Tên đăng nhập đã tồn tại' })

    const nameExists = await UserModel.findOne({ name: normalizedName })
    if (nameExists) return res.status(409).json({ success: false, message: 'Ten hien thi da ton tai' })

    // Ma h?a m?t kh?u
    const hashedPassword = await bcrypt.hash(password, 10)

    // T?o user m?i v?i vai tr� 'user' m?c d?nh
    const newUser = new UserModel({
      name: normalizedName,
      username: normalizedUsername,
      email: normalizedEmail,
      password: hashedPassword,
      roles: ['user'],
    })
    await newUser.save()

    return res.status(201).json({
      success: true,
      message: 'Đăng ký thành công',
      data: {
        id: newUser._id,
        name: newUser.name,
        username: newUser.username,
        email: newUser.email,
        roles: newUser.roles,
      },
    })
  } catch (error) {
    console.error('Lỗi đăng ký:', error)
    return res.status(500).json({ success: false, message: 'Lỗi máy chủ' })
  }
}

// Đăng nhập: trả JWT qua cookie HttpOnly + cấp CSRF token
export const login = async (req, res) => {
  try {
    const { user, pwd } = req.body
    const userInput = (user || '').trim()
    const emailInput = userInput.toLowerCase()

    // Kiểm tra dữ liệu đầu vào
    if (!userInput || !pwd) {
      return res.status(400).json({ success: false, message: 'Thiếu tên đăng nhập hoặc mật khẩu' })
    }

    // Tìm user theo username hoặc email
    const foundUser = await UserModel.findOne({
      $or: [{ username: userInput }, { email: emailInput }],
      isActive: true,
      isDeleted: false,
    }).select('+password')

    // Không tìm thấy user
    if (!foundUser) return res.status(401).json(
      { success: false, message: 'Không tìm thấy tài khoản' })

    // So sánh mật khẩu
    const isPasswordValid = await bcrypt.compare(pwd, foundUser.password)
    if (!isPasswordValid) return res.status(401).json(
      { success: false, message: 'Mật khẩu không chính xác' })

    // Tạo và gửi cookie JWT
    const secret = process.env.JWT_SECRET
    if (!secret) throw new Error('JWT_SECRET chưa được cấu hình')

    // Token JWT có thời hạn 24 giờ
    const maxAgeMs = 24 * 60 * 60 * 1000
    
    const accessToken = jwt.sign(
      // Payload token
      { userId: foundUser._id, username: foundUser.username, roles: foundUser.roles },
      secret,
      { expiresIn: Math.floor(maxAgeMs / 1000) }
    )

    setJwtCookie(res, accessToken, maxAgeMs)

    // Cấp CSRF token qua cookie (không HttpOnly) để FE gắn vào header
    const csrf = createCsrfToken()
    setCsrfCookie(res, csrf)

    return res.json({
      success: true,
      message: 'Đăng nhập thành công',
      data: {
        user: {
          id: foundUser._id,
          name: foundUser.name,
          username: foundUser.username,
          email: foundUser.email,
          roles: foundUser.roles,
        },
      },
    })
  } catch (error) {
    console.error('Lỗi đăng nhập:', error)
    return res.status(500).json({ success: false, message: 'Lỗi máy chủ' })
  }
}

// Đăng xuất: xóa cookie JWT và CSRF
export const logout = async (req, res) => {
  try {
    res.clearCookie('jwt', {
      httpOnly: true,
      sameSite: COOKIE_SAMESITE,
      secure: COOKIE_SECURE || COOKIE_SAMESITE === 'none',
      path: '/',
    })
    res.clearCookie('csrfToken', {
      httpOnly: false,
      sameSite: COOKIE_SAMESITE,
      secure: COOKIE_SECURE || COOKIE_SAMESITE === 'none',
      path: '/',
    })
    return res.json({ success: true, message: 'Đăng xuất thành công' })
  } catch (error) {
    console.error('Lỗi đăng xuất:', error)
    return res.status(500).json({ success: false, message: 'Lỗi máy chủ' })
  }
}

// Heartbeat: gia hạn cookie JWT (sliding TTL)
export const heartbeat = async (req, res) => {
  try {
    // Yêu cầu phải đã được xác thực (middleware verifyToken)
    const secret = process.env.JWT_SECRET
    if (!secret) throw new Error('JWT_SECRET chưa được cấu hình')
    const { userId, username, roles } = req.user || {}
    if (!userId) return res.status(401).json({ success: false, message: 'Không xác thực' })

    const maxAgeMs = 24 * 60 * 60 * 1000
    const accessToken = jwt.sign(
      { userId, username, roles }, 
      secret, 
      { expiresIn: Math.floor(maxAgeMs / 1000) })
    setJwtCookie(res, accessToken, maxAgeMs)
    return res.json({ success: true })
  } catch (error) {
    console.error('Lỗi heartbeat:', error)
    return res.status(500).json({ success: false, message: 'Lỗi máy chủ' })
  }
}

// Cấp token CSRF (tiện khởi tạo ở FE)
export const csrfToken = (req, res) => {
  const token = createCsrfToken()
  setCsrfCookie(res, token)
  return res.json({ success: true, csrfToken: token })
}
