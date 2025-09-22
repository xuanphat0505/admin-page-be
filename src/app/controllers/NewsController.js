import NewsModel from '../models/NewsModel.js';
import slugify from 'slugify';

export const uploadNews = async (req, res) => {
  try {
    const { title, blocks, category, author } = req.body;
    const files = req.files;

    // Parse blocks from JSON string
    let parsedBlocks;
    try {
      parsedBlocks = JSON.parse(blocks);
    } catch (error) {
      return res.status(400).json({ success: false, message: 'Blocks data không hợp lệ.' });
    }

    if (!title || !files?.thumbnail || !parsedBlocks || parsedBlocks.length === 0) {
      return res
        .status(400)
        .json({ success: false, message: 'Title, thumbnail và blocks là bắt buộc.' });
    }

    // Xử lý ảnh trong blocks
    const processedBlocks = parsedBlocks.map((block) => {
      if (block.type === 'image' && block.content) {
        // Tìm file ảnh tương ứng trong blockImages
        const imageFile = files.blockImages?.find((file) => file.originalname === block.content);

        if (imageFile) {
          return {
            ...block,
            content: imageFile.path, // Cloudinary URL
          };
        }
      }
      return block;
    });

    const news = await NewsModel.create({
      title: title.trim(),
      slugId: slugify(title, {
        lower: true,
        strict: true,
        locale: 'vi',
      }),
      thumbnail: files.thumbnail[0].path, // Cloudinary URL
      blocks: processedBlocks,
      category: category || 'Tin tổng hợp',
      author: author || 'Admin',
    });

    return res.status(201).json({
      success: true,
      message: 'Đăng tin tức thành công',
      data: {
        id: news._id,
        title: news.title,
        thumbnail: news.thumbnail,
        category: news.category,
        author: news.author,
        createdAt: news.createdAt,
      },
    });
  } catch (error) {
    return res.status(500).json({
      success: false,
      message: error.message || 'Có lỗi xảy ra khi đăng tin tức',
    });
  }
};

export const getNews = async (req, res) => {
  try {
    // Lấy page & limit từ query params, mặc định page=1, limit=10
    const page = parseInt(req.query.page) || 1;
    const limit = 10;

    // Tính skip (bỏ qua bao nhiêu bản ghi)
    const skip = (page - 1) * limit;

    // Đếm tổng số tin để trả về totalPages
    const totalItems = await NewsModel.countDocuments();

    // Lấy dữ liệu với phân trang
    const news = await NewsModel.find().sort({ createdAt: -1 }).skip(skip).limit(limit);

    return res.status(200).json({
      success: true,
      message: 'Lấy danh sách tin tức thành công',
      data: news,
      pagination: {
        totalItems,
        currentPage: page,
        totalPages: Math.ceil(totalItems / limit),
        pageSize: limit,
      },
    });
  } catch (error) {
    return res.status(500).json({
      success: false,
      message: error.message,
    });
  }
};
