import express from 'express';
import { register, login, logout, heartbeat, csrfToken } from '../app/controllers/AuthController.js';
import { authRateLimit } from '../middlewares/rateLimit.js';
import { verifyJWT, verifyCsrf } from '../middlewares/verify.js';

const router = express.Router();

// POST /api/v1/auth/register - Đăng ký
router.post('/register', authRateLimit, register);

// POST /api/v1/auth - Đăng nhập  
router.post('/', authRateLimit, login);

// POST /api/v1/auth/logout - Đăng xuất
router.post('/logout', verifyJWT, verifyCsrf, logout);

// GET /api/v1/auth/heartbeat - Kiểm tra trạng thái đăng nhập
router.get('/heartbeat', verifyJWT, heartbeat);

// GET /api/v1/auth/csrf-token - Lấy CSRF token mới
router.get('/csrf-token', csrfToken);

export default router;
