import NewsModel from "../models/NewsModel.js";
import slugify from "slugify";

export const uploadNews = async (req, res) => {
  try {
    const { title, blocks, category, author, targetSites } = req.body;
    const files = req.files;

    // Parse blocks từ JSON
    let parsedBlocks;
    try {
      parsedBlocks = JSON.parse(blocks);
    } catch (error) {
      return res
        .status(400)
        .json({ success: false, message: "Blocks data không hợp lệ." });
    }

    // Parse targetSites từ JSON
    let parsedTargetSites;
    try {
      parsedTargetSites = targetSites ? JSON.parse(targetSites) : [];
    } catch (error) {
      return res
        .status(400)
        .json({ success: false, message: "Target sites data không hợp lệ." });
    }

    if (
      !title ||
      !files?.thumbnail ||
      !parsedBlocks ||
      parsedBlocks.length === 0
    ) {
      return res.status(400).json({
        success: false,
        message: "Title, thumbnail và blocks là bắt buộc.",
      });
    }

    // Xử lý ảnh trong blocks + chuẩn hoá richText
    const processedBlocks = parsedBlocks.map((block) => {
      let newBlock = { ...block };

      // Nếu block là image, tìm file upload từ multer
      if (block.type === "image" && block.content) {
        const imageFile = files.blockImages?.find(
          (file) => file.originalname === block.content
        );

        if (imageFile) {
          newBlock.content = imageFile.path; // Cloudinary URL
        }
      }

      // Nếu block có richText nhưng chỉ là string → convert thành mảng [{ text }]
      if (block.type === "paragraph" || block.type === "heading") {
        if (typeof block.richText === "string") {
          newBlock.richText = [{ text: block.richText }];
        } else if (Array.isArray(block.content)) {
          // trường hợp content chứa array -> copy sang richText
          newBlock.richText = block.content;
        } else if (!block.richText && block.content) {
          // nếu chỉ có content string
          newBlock.richText = [{ text: block.content }];
        }
      }

      if (block.type === "list") {
        // Đảm bảo list là array của array<richText>
        newBlock.content = (block.content || []).map((item) =>
          typeof item === "string" ? [{ text: item }] : item
        );
      }

      return newBlock;
    });

    // Tạo tin tức trong DB
    const news = await NewsModel.create({
      title: title.trim(),
      slugId: slugify(title, {
        lower: true,
        strict: true,
        locale: "vi",
      }),
      thumbnail: files.thumbnail[0].path, // Cloudinary URL
      blocks: processedBlocks,
      category: category || "Tin tổng hợp",
      author: author || "Admin",
      targetSites: parsedTargetSites,
    });

    return res.status(201).json({
      success: true,
      message: "Đăng tin tức thành công",
      data: {
        id: news._id,
        title: news.title,
        thumbnail: news.thumbnail,
        category: news.category,
        author: news.author,
        targetSites: news.targetSites,
        createdAt: news.createdAt,
      },
    });
  } catch (error) {
    console.error("❌ uploadNews error:", error);
    return res.status(500).json({
      success: false,
      message: error.message || "Có lỗi xảy ra khi đăng tin tức",
    });
  }
};

export const getNews = async (req, res) => {
  try {
    // Lấy page & limit từ query params, mặc định page=1, limit=10
    const page = parseInt(req.query.page) || 1;
    const limit = 12;

    // Tính skip (bỏ qua bao nhiêu bản ghi)
    const skip = (page - 1) * limit;

    // Đếm tổng số tin để trả về totalPages
    const totalItems = await NewsModel.countDocuments();

    // Lấy dữ liệu với phân trang
    const news = await NewsModel.find()
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(limit);

    return res.status(200).json({
      success: true,
      message: "Lấy danh sách tin tức thành công",
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

export const getDetailNews = async (req, res) => {
  const newsId = req.params.id;
  try {
    const news = await NewsModel.findOne({ slugId: newsId });
    if (!news) {
      return res
        .status(404)
        .json({ success: false, message: "News not found" });
    }

    return res
      .status(200)
      .json({ success: true, message: "Get success", data: news });
  } catch (error) {
    return res.status(500).json({ success: false, message: error.message });
  }
};
