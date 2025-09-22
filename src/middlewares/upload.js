import multer from 'multer';
import { CloudinaryStorage } from 'multer-storage-cloudinary';
import cloudinary from '../config/cloudinary.js';

// Cấu hình storage cho Cloudinary
const storage = new CloudinaryStorage({
  cloudinary,
  params: async (req, file) => {
    // Chỉ cho phép ảnh
    if (!file.mimetype.startsWith('image/')) {
      throw new Error('Chỉ được upload file ảnh (jpg, png, gif, webp)');
    }

    return {
      folder: 'news_uploads', // thư mục lưu trên Cloudinary
      resource_type: 'image',
      use_filename: true, // giữ nguyên tên gốc
      unique_filename: false, // không random thêm chuỗi
      public_id: file.originalname, // giữ tên file không có đuôi mở rộng
    };
  },
});

// Multer middleware
const uploadNewsImage = multer({
  storage,
  limits: {
    fileSize: 5 * 1024 * 1024, // 5MB limit
  },
});

export default uploadNewsImage;
