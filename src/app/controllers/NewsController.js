import NewsModel from "../models/NewsModel.js";
import slugify from "slugify";

export const uploadNews = async (req, res) => {
  try {
    const { title, description, blocks, category, author, targetSites } =
      req.body;
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
      !description ||
      !files?.thumbnail ||
      !parsedBlocks ||
      parsedBlocks.length === 0
    ) {
      return res.status(400).json({
        success: false,
        message: "Title, description, thumbnail và blocks là bắt buộc.",
      });
    }

    // Validate độ dài description
    if (description.length > 300) {
      return res.status(400).json({
        success: false,
        message: "Description không được vượt quá 300 ký tự.",
      });
    }

    // Xử lý ảnh trong blocks + chuẩn hoá richText
    const processedBlocks = parsedBlocks.map((block) => {
      let newBlock = { ...block };

      if (block.type === "image" && block.content) {
        const imageFile = files.blockImages?.find(
          (file) => file.originalname === block.content
        );
        if (imageFile) {
          newBlock.content = imageFile.path; // Cloudinary URL
        }
      }

      if (block.type === "paragraph" || block.type === "heading") {
        if (typeof block.richText === "string") {
          newBlock.richText = [{ text: block.richText }];
        } else if (Array.isArray(block.content)) {
          newBlock.richText = block.content;
        } else if (!block.richText && block.content) {
          newBlock.richText = [{ text: block.content }];
        }
      }

      if (block.type === "list") {
        newBlock.content = (block.content || []).map((item) =>
          typeof item === "string" ? [{ text: item }] : item
        );
      }

      return newBlock;
    });

    // Tạo tin tức trong DB
    const news = await NewsModel.create({
      title: title.trim(),
      description: description.trim(),
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
        description: news.description,
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

export const getAllNews = async (req, res) => {
  try {
    const news = await NewsModel.find();
    if (!news) {
      return res
        .status(404)
        .json({ success: false, message: "News not found" });
    }
    return res
      .status(200)
      .json({ success: true, message: "Get all news success" });
  } catch (error) {
    return res.status(500).json({ success: false, message: error.message });
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

export const getHomepageNews = async (req, res) => {
  try {
    const highlight = await NewsModel.find({ category: "highlight" })
      .limit(3)
      .sort({ createdAt: -1 });
    const popular = await NewsModel.find({ category: "popular" })
      .limit(3)
      .sort({ createdAt: -1 });
    const greenLife = await NewsModel.find({ category: "green-life" })
      .limit(5)
      .sort({ createdAt: -1 });
    const chat = await NewsModel.find({ category: "chat" })
      .limit(5)
      .sort({ createdAt: -1 });
    const health = await NewsModel.find({ category: "health" })
      .limit(5)
      .sort({ createdAt: -1 });

    return res.status(200).json({
      success: true,
      message: "Lấy dữ liệu trang chủ thành công",
      data: {
        highlight,
        popular,
        greenLife,
        chat,
        health,
      },
    });
  } catch (error) {
    return res.status(500).json({
      success: false,
      message: error.message,
    });
  }
};
