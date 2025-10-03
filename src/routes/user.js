import express from 'express';
import { 
    getAllUsers, 
    getUserById, 
    updateUser, 
    deleteUser, 
    changePassword 
} from '../app/controllers/UserController.js';
import { verifyJWT, requireRole, verifyCsrf } from '../middlewares/verify.js';

const router = express.Router();

// GET /api/v1/users - Lấy danh sách tất cả users
router.get('/', verifyJWT, requireRole('admin'), getAllUsers);

// GET /api/v1/users/:id - Lấy thông tin user theo ID
router.get('/:id', verifyJWT, requireRole('admin'), getUserById);

// PUT /api/v1/users/:id - Cập nhật thông tin user
router.put('/:id', verifyJWT, requireRole('admin'), verifyCsrf, updateUser);

// DELETE /api/v1/users/:id - Xóa user (soft delete)
router.delete('/:id', verifyJWT, requireRole('admin'), verifyCsrf, deleteUser);

// PUT /api/v1/users/:id/change-password - Đổi mật khẩu
router.put('/:id/change-password', verifyJWT, verifyCsrf, changePassword);

export default router;
