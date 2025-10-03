import jwt from 'jsonwebtoken'
import crypto from 'crypto'

// Cấu hình cookie cho môi trường hiện tại
const COOKIE_SAMESITE = (process.env.COOKIE_SAMESITE || 'lax').toLowerCase()
const COOKIE_SECURE = process.env.COOKIE_SECURE === 'true' || process.env.NODE_ENV === 'production'

// Tên cookie CSRF và header tương ứng
const CSRF_COOKIE_NAME = 'csrfToken'
const CSRF_HEADER_NAME = 'x-csrf-token'

// Tạo token CSRF ngẫu nhiên (hex)
export const createCsrfToken = () => crypto.randomBytes(32).toString('hex')

// Đặt cookie CSRF (không HttpOnly) để FE có thể đọc và gửi lại qua header
export const setCsrfCookie = (res, token) => {
  res.cookie(CSRF_COOKIE_NAME, token, {
    httpOnly: false,
    sameSite: COOKIE_SAMESITE,
    secure: COOKIE_SECURE || COOKIE_SAMESITE === 'none',
    path: '/',
  })
}

// Endpoint handler: phát hành token CSRF và trả về cho FE
export const issueCsrfToken = (req, res) => {
  const token = createCsrfToken()
  setCsrfCookie(res, token)
  return res.json({ success: true, csrfToken: token })
}

// Middleware: xác thực CSRF cho các method thay đổi trạng thái
export const verifyCsrf = (req, res, next) => {
  const method = (req.method || 'GET').toUpperCase()
  const safe = ['GET', 'HEAD', 'OPTIONS'] // Các method không cần CSRF

  // Nếu là method an toàn thì không cần kiểm tra CSRF
  if (safe.includes(method)) return next()

  // Lấy token từ cookie và header
  const cookieToken = req.cookies?.[CSRF_COOKIE_NAME]
  const headerToken = req.headers?.[CSRF_HEADER_NAME]

  // So sánh token  
  if (!cookieToken || !headerToken || cookieToken !== headerToken) {
    return res.status(403).json({ success: false, message: 'CSRF token không hợp lệ' })
  }
  next()
}

// Middleware: xác thực JWT từ cookie 'jwt'
export const verifyJWT = (req, res, next) => {
  try {
    // Lấy token từ cookie
    const token = req.cookies?.jwt
    if (!token) return res.status(401).json({ success: false, message: 'Thiếu token' })

    // Giải mã và kiểm tra token
    const secret = process.env.JWT_SECRET
    if (!secret) throw new Error('JWT_SECRET chưa được cấu hình')

    // Nếu token hợp lệ thì gắn thông tin user vào req.user
    const decoded = jwt.verify(token, secret)
    req.user = decoded
    next()
  } catch (err) {
    return res.status(401).json({ success: false, message: 'Xác thực thất bại' })
  }
}

// Middleware: yêu cầu vai trò cụ thể
export const requireRole = (role) => (req, res, next) => {
  const roles = req.user?.roles || []
  if (!roles.includes(role)) {
    return res.status(403).json({ success: false, message: 'Không đủ quyền' })
  }
  next()
}

// Tập vai trò hợp lệ (dùng để kiểm tra dữ liệu đầu vào)
export const ALLOWED_ROLES = ['user', 'editor', 'admin']

