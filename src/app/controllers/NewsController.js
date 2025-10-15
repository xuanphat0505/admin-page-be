import slugify from "slugify";
import NewsModel from "../models/NewsModel.js";

const pickPlainText = (segments = []) =>
  segments.map((segment) => segment?.text || "").join("").trim();

const normalizeBlock = (block, files) => {
  if (!block || !block.type) return null;
  const type = block.type;

  if (type === "image") {
    const alt = (block.alt ?? block?.content?.alt ?? "").trim();
    const caption = (block.caption ?? block?.content?.caption ?? "").trim();
    const rawName =
      typeof block.url === "string" && block.url.trim()
        ? block.url.trim()
        : typeof block.content === "string"
        ? block.content.trim()
        : "";

    let url = rawName;
    if (Array.isArray(files?.blockImages) && rawName) {
      const matched = files.blockImages.find(
        (file) => file.originalname === rawName,
      );
      if (matched) {
        url = matched.path;
      }
    }

    return { type, url, alt, caption };
  }

  if (type === "heading") {
    const levelSource =
      block.level ||
      block?.content?.level ||
      (Array.isArray(block.level) ? block.level[0] : "H2");
    const level = typeof levelSource === "string" ? levelSource.toUpperCase() : "H2";
    const headingText =
      typeof block.text === "string"
        ? block.text
        : typeof block?.content?.text === "string"
        ? block.content.text
        : "";

    const normalized = {
      type,
      level,
      text: headingText.trim(),
    };

    if (Array.isArray(block.richText)) {
      normalized.richText = block.richText;
    }

    return normalized;
  }

  if (type === "paragraph") {
    if (Array.isArray(block.richText)) {
      return {
        type,
        richText: block.richText,
        text: pickPlainText(block.richText),
      };
    }
    if (Array.isArray(block.content)) {
      return {
        type,
        richText: block.content,
        text: pickPlainText(block.content),
      };
    }
    if (typeof block.text === "string") {
      return { type, text: block.text.trim() };
    }
    if (typeof block.content === "string") {
      return { type, text: block.content.trim() };
    }
    return { type, text: "" };
  }

  if (type === "list") {
    const itemsSource = Array.isArray(block.items) ? block.items : block.content;
    const items = Array.isArray(itemsSource)
      ? itemsSource.map((item) => {
          if (Array.isArray(item)) return item;
          if (typeof item === "string") return [{ text: item }];
          if (Array.isArray(item?.richText)) return item.richText;
          return [];
        })
      : [];

    return { type, items };
  }

  return { type };
};

export const uploadNews = async (req, res) => {
  try {
    const {
      title,
      description = "",
      content: contentPayload,
      blocks: legacyBlocksPayload,
      category,
      author,
      targetSites,
    } = req.body;
    const files = req.files;

    const rawContent = contentPayload ?? legacyBlocksPayload;
    if (!rawContent) {
      return res
        .status(400)
        .json({ success: false, message: "Thiếu dữ liệu nội dung bài viết." });
    }

    let parsedContent;
    try {
      parsedContent =
        typeof rawContent === "string" ? JSON.parse(rawContent) : rawContent;
    } catch (error) {
      return res
        .status(400)
        .json({ success: false, message: "Nội dung bài viết không hợp lệ." });
    }

    let parsedTargetSites;
    try {
      parsedTargetSites = targetSites ? JSON.parse(targetSites) : [];
    } catch (error) {
      return res
        .status(400)
        .json({ success: false, message: "Danh sách website mục tiêu không hợp lệ." });
    }

    if (!Array.isArray(parsedTargetSites) || parsedTargetSites.length === 0) {
      return res
        .status(400)
        .json({ success: false, message: "Cần chọn ít nhất một website mục tiêu." });
    }

    const trimmedTitle = (title || "").trim();
    const trimmedDescription = (description || "").trim();

    if (
      !trimmedTitle ||
      !trimmedDescription ||
      !files?.thumbnail ||
      !Array.isArray(parsedContent) ||
      parsedContent.length === 0
    ) {
      return res.status(400).json({
        success: false,
        message: "Thiếu tiêu đề, mô tả, ảnh minh họa hoặc nội dung.",
      });
    }

    if (trimmedDescription.length > 300) {
      return res
        .status(400)
        .json({ success: false, message: "Mô tả không được vượt quá 300 ký tự." });
    }

    const normalizedContent = parsedContent
      .map((block) => normalizeBlock(block, files))
      .filter((block) => block !== null);

    if (normalizedContent.length === 0) {
      return res
        .status(400)
        .json({ success: false, message: "Không có nội dung hợp lệ để lưu." });
    }

    const missingImageMeta = normalizedContent.some(
      (block) => block.type === "image" && (!block.alt || !block.caption),
    );

    if (missingImageMeta) {
      return res
        .status(400)
        .json({ success: false, message: "Ảnh phải có mô tả (alt) và chú thích." });
    }

    const news = await NewsModel.create({
      title: trimmedTitle,
      description: trimmedDescription,
      slugId: slugify(trimmedTitle, { lower: true, strict: true, locale: "vi" }),
      thumbnail: files.thumbnail[0].path,
      content: normalizedContent,
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
        content: news.content,
      },
    });
  } catch (error) {
    console.error("Lỗi uploadNews:", error);
    return res.status(500).json({ success: false, message: "Lỗi hệ thống." });
  }
};

export const getNews = async (req, res) => {
  try {
    const page = parseInt(req.query.page, 10) || 1;
    const limit = 12;
    const skip = (page - 1) * limit;

    const totalItems = await NewsModel.countDocuments();
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
    console.error("Lỗi getNews:", error);
    return res.status(500).json({ success: false, message: "Lỗi hệ thống." });
  }
};

export const getAllNews = async (req, res) => {
  try {
    const news = await NewsModel.find();
    if (!news || news.length === 0) {
      return res.status(404).json({ success: false, message: "Không có tin tức." });
    }
    return res
      .status(200)
      .json({ success: true, message: "Lấy tin tức thành công", data: news });
  } catch (error) {
    console.error("Lỗi getAllNews:", error);
    return res.status(500).json({ success: false, message: "Lỗi hệ thống." });
  }
};

export const getDetailNews = async (req, res) => {
  const newsId = req.params.id;
  try {
    const news = await NewsModel.findOne({ slugId: newsId });
    if (!news) {
      return res.status(404).json({ success: false, message: "Không tìm thấy tin tức." });
    }

    return res
      .status(200)
      .json({ success: true, message: "Lấy tin tức thành công", data: news });
  } catch (error) {
    console.error("Lỗi getDetailNews:", error);
    return res.status(500).json({ success: false, message: "Lỗi hệ thống." });
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
    console.error("Lỗi getHomepageNews:", error);
    return res.status(500).json({ success: false, message: "Lỗi hệ thống." });
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
