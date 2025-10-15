// Rate limit đơn giản trong bộ nhớ (in-memory)

const buckets = new Map()

// Tạo middleware rate limit với cấu hình
export const simpleRateLimit = ({ windowMs = 60_000, max = 30, key = (req) => req.ip }) => {
  return (req, res, next) => {
    const k = key(req)
    const now = Date.now()
    // Lấy bucket hiện tại hoặc khởi tạo mới
    const entry = buckets.get(k) || { count: 0, resetAt: now + windowMs } 

    // Đã hết window, reset
    if (now > entry.resetAt) {
      entry.count = 0
      entry.resetAt = now + windowMs
    }

    entry.count += 1
    buckets.set(k, entry)

    // Quá giới hạn
    if (entry.count > max) {
      // Gửi kèm header Retry-After (giây)
      const retryAfter = Math.ceil((entry.resetAt - now) / 1000)
      res.setHeader('Retry-After', retryAfter)
      // Trả về lỗi 429
      return res.status(429).json({
        success: false,
        message: 'Vượt quá giới hạn yêu cầu, vui lòng thử lại sau.',
      })
    }
    next()
  }
}

// Preset cho auth (đăng nhập/đăng ký)
export const authRateLimit = simpleRateLimit({ windowMs: 5 * 60_000, max: 20 }) // 20 req/5 phút

