import slugify from "slugify";
import stringSimilarity from "string-similarity";
import NewsModel from "../models/NewsModel.js";

const pickPlainText = (segments = []) =>
  segments
    .map((segment) => segment?.text || "")
    .join("")
    .trim();

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
    const level =
      typeof levelSource === "string" ? levelSource.toUpperCase() : "H2";
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
    const itemsSource = Array.isArray(block.items)
      ? block.items
      : block.content;
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

const DEFAULT_CATEGORY = { value: "Tin tong hop", slug: "tin-tong-hop" };
const MAX_CATEGORY_LABEL_LENGTH = 128;

const normalizeCategoryInput = (input) => {
  if (!input) return null;

  if (typeof input === "string") {
    const label = input.trim();
    if (!label || label.length > MAX_CATEGORY_LABEL_LENGTH) return null;
    const slug = slugify(label, { lower: true, strict: true, locale: "vi", trim: true });
    if (!slug) return null;
    return { value: label, slug };
  }

  if (typeof input === "object") {
    const rawLabel =
      (typeof input.value === "string" && typeof input.slug === "string"
        ? input.value
        : undefined) ||
      input.label ||
      input.name ||
      input.title ||
      input.value;
    const label = typeof rawLabel === "string" ? rawLabel.trim() : "";
    const rawSlug = typeof input.slug === "string" ? input.slug.trim() : "";
    const fallbackSlug =
      rawSlug ||
      (typeof input.value === "string" && !label ? input.value.trim() : "") ||
      "";

    if (!label && !fallbackSlug) return null;

    const finalLabel = label || fallbackSlug;
    if (finalLabel.length > MAX_CATEGORY_LABEL_LENGTH) return null;

    const slugSource = fallbackSlug || finalLabel;
    const slug = slugify(slugSource, { lower: true, strict: true, locale: "vi", trim: true });
    if (!slug) return null;

    return { value: finalLabel, slug };
  }

  return null;
};

const normalizeCategoryList = (categories) => {
  if (!Array.isArray(categories)) {
    return { normalized: [], invalid: false };
  }

  const map = new Map();
  let invalid = false;

  categories.forEach((item) => {
    const normalized = normalizeCategoryInput(item);
    if (!normalized) {
      invalid = true;
      return;
    }
    if (!map.has(normalized.slug)) {
      map.set(normalized.slug, normalized);
    }
  });

  return { normalized: Array.from(map.values()), invalid };
};

const extractCategorySlugs = (categories) => {
  if (!Array.isArray(categories)) return [];
  return categories
    .map((item) => {
      if (!item) return "";
      if (typeof item === "string") return item.trim();
      if (typeof item === "object") {
        if (typeof item.slug === "string" && item.slug.trim()) return item.slug.trim();
        if (typeof item.value === "string" && item.value.trim()) {
          return slugify(item.value.trim(), { lower: true, strict: true, locale: "vi", trim: true });
        }
      }
      return "";
    })
    .filter(Boolean);
};

const categoryMatchesSlug = (categoryEntry, slug) => {
  if (!slug) return false;
  if (typeof categoryEntry === "string") {
    return categoryEntry === slug;
  }
  if (categoryEntry && typeof categoryEntry === "object") {
    return categoryEntry.slug === slug || categoryEntry.value === slug;
  }
  return false;
};

const  helperGetByCategory = (slug, limit) =>{
  return NewsModel.find({
    $or: [
      { "categories.slug": slug },        // nếu categories là mảng object
      // { categories:  [slug] },    // nếu categories là mảng string
      // { category: slug }                  // nếu có field category đơn
    ],
  })
    .limit(limit)
    .sort({ createdAt: -1 });
}

export const uploadNews = async (req, res) => {
  try {
    const {
      title,
      description = "",
      content: contentPayload,
      blocks: legacyBlocksPayload,
      categories,
      author,
      targetSites,
    } = req.body;
    const files = req.files;

    const rawContent = contentPayload ?? legacyBlocksPayload;
    if (!rawContent) {
      return res
        .status(400)
        .json({ success: false, message: "Thieu du lieu noi dung bai viet." });
    }

    let parsedContent;
    try {
      parsedContent =
        typeof rawContent === "string" ? JSON.parse(rawContent) : rawContent;
    } catch (error) {
      return res
        .status(400)
        .json({ success: false, message: "Noi dung bai viet khong hop le." });
    }

    let parsedTargetSites = [];
    try {
      parsedTargetSites = targetSites ? JSON.parse(targetSites) : [];
    } catch (error) {
      parsedTargetSites = Array.isArray(targetSites) ? targetSites : [];
    }
    if (!Array.isArray(parsedTargetSites)) {
      parsedTargetSites = [];
    }
    parsedTargetSites = parsedTargetSites
      .filter((item) => typeof item === "string" && item.trim().length > 0)
      .map((item) => item.trim());
    parsedTargetSites = Array.from(new Set(parsedTargetSites));

    let parsedCategories = [];
    try {
      parsedCategories = categories ? JSON.parse(categories) : [];
    } catch (error) {
      parsedCategories = Array.isArray(categories) ? categories : [];
    }
    if (!Array.isArray(parsedCategories)) {
      parsedCategories = [parsedCategories].filter(Boolean);
    }

    if (!Array.isArray(parsedTargetSites) || parsedTargetSites.length === 0) {
      return res.status(400).json({
        success: false,
        message: "Can chon it nhat mot website muc tieu.",
      });
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
        message: "Thieu tieu de, mo ta, anh minh hoa hoac noi dung.",
      });
    }

    if (trimmedDescription.length > 300) {
      return res.status(400).json({
        success: false,
        message: "Mo ta khong duoc vuot qua 300 ky tu.",
      });
    }

    const normalizedContent = parsedContent
      .map((block) => normalizeBlock(block, files))
      .filter((block) => block !== null);

    if (normalizedContent.length === 0) {
      return res
        .status(400)
        .json({ success: false, message: "Khong co noi dung hop le de luu." });
    }

    const missingImageMeta = normalizedContent.some(
      (block) => block.type === "image" && (!block.alt || !block.caption),
    );

    if (missingImageMeta) {
      return res.status(400).json({
        success: false,
        message: "Anh phai co mo ta (alt) va chu thich.",
      });
    }

    const {
      normalized: normalizedCategories,
      invalid: invalidCategories,
    } = normalizeCategoryList(parsedCategories);

    if (invalidCategories) {
      return res.status(400).json({
        success: false,
        message: "Danh sach chuyen muc khong hop le.",
      });
    }

    const categoriesToSave =
      normalizedCategories.length > 0 ? normalizedCategories : [{ ...DEFAULT_CATEGORY }];

    const localizedSlug = slugify(trimmedTitle, {
      lower: true,
      strict: true,
      locale: "vi",
      trim: true,
    });
    const fallbackSlug = slugify(trimmedTitle, { lower: true, strict: true, trim: true });
    const slugId = localizedSlug || fallbackSlug;

    const news = await NewsModel.create({
      title: trimmedTitle,
      description: trimmedDescription,
      slugId,
      thumbnail: files.thumbnail[0].path,
      content: normalizedContent,
      categories: categoriesToSave,
      author: author || "Admin",
      targetSites: parsedTargetSites,
    });

    return res.status(201).json({
      success: true,
      message: "Dang tin tuc thanh cong",
      data: {
        id: news._id,
        title: news.title,
        description: news.description,
        thumbnail: news.thumbnail,
        categories: news.categories,
        author: news.author,
        targetSites: news.targetSites,
        createdAt: news.createdAt,
        content: news.content,
      },
    });
  } catch (error) {
    console.error("Loi uploadNews:", error);

    if (error?.code === 11000 && error?.keyPattern?.slugId) {
      return res.status(409).json({
        success: false,
        message: "Tieu de nay da duoc su dung, vui long chon tieu de khac.",
      });
    }

    if (error?.name === "ValidationError") {
      const messages = Object.values(error.errors || {}).map((err) => err.message);
      return res.status(422).json({
        success: false,
        message: messages[0] || "Du lieu khong hop le.",
      });
    }

    return res.status(500).json({ success: false, message: "Loi he thong." });
  }
};

export const getNews = async (req, res) => {
  try {
    const page = parseInt(req.query.page, 10) || 1;
    const limit = parseInt(req.query.limit, 10) || 12;
    const skip = (page - 1) * limit;

    const { category, keyword } = req.query;

    let filter = {};

    if (category) {
      filter.$or = [
        { "categories.slug": category },
        // { categories: [category] },
        // { category },
      ];
    }

    if (keyword && keyword.trim()) {
      const searchRegex = new RegExp(keyword.trim(), "i");
      const keywordFilter = {
        $or: [{ title: searchRegex }, { description: searchRegex }],
      };

      filter = filter.$or
        ? { $and: [{ $or: filter.$or }, keywordFilter] }
        : keywordFilter;
    }

    const totalItems = await NewsModel.countDocuments(filter);
    const news = await NewsModel.find(filter)
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(limit);

    return res.status(200).json({
      success: true,
      message: "Lay danh sach tin tuc thanh cong",
      data: news,
      pagination: {
        totalItems,
        currentPage: page,
        totalPages: Math.ceil(totalItems / limit),
        pageSize: limit,
      },
    });
  } catch (error) {
    console.error("Loi getNews:", error);
    return res.status(500).json({ success: false, message: "Loi he thong." });
  }
};

export const getAllNews = async (req, res) => {
  try {
    const news = await NewsModel.find();
    if (!news || news.length === 0) {
      return res
        .status(404)
        .json({ success: false, message: "Khong co tin tuc." });
    }
    return res
      .status(200)
      .json({ success: true, message: "Lay tin tuc thanh cong", data: news });
  } catch (error) {
    console.error("Loi getAllNews:", error);
    return res.status(500).json({ success: false, message: "Loi he thong." });
  }
};

export const getDetailNews = async (req, res) => {
  const newsId = req.params.id;
  try {
    const news = await NewsModel.findOne({ slugId: newsId });
    if (!news) {
      return res
        .status(404)
        .json({ success: false, message: "Khong tim thay tin tuc." });
    }

    return res
      .status(200)
      .json({ success: true, message: "Lay tin tuc thanh cong", data: news });
  } catch (error) {
    console.error("Loi getDetailNews:", error);
    return res.status(500).json({ success: false, message: "Loi he thong." });
  }
};

export const getHomepageNews = async (req, res) => {
  try {
    const [highlight, popular, greenLife, chat, health] = await Promise.all([
      helperGetByCategory("highlight", 3),
      helperGetByCategory("popular", 3),
      helperGetByCategory("green-life", 5),
      helperGetByCategory("chat", 5),
      helperGetByCategory("health", 5),
    ]);

    return res.status(200).json({
      success: true,
      message: "Lấy dữ liệu trang chủ thành công",
      data: { highlight, popular, greenLife, chat, health },
    });
  } catch (error) {
    console.error("Lỗi getHomepageNews:", error);
    return res.status(500).json({ success: false, message: "Lỗi hệ thống." });
  }
};

function getSlugRoot(slug) {
  return slug.replace(/-so-\d+$/, "");
}

export const getRelatedPosts = async (req, res) => {
  try {
    const { slug } = req.params;
    const current = await NewsModel.findOne({ slugId: slug });
    if (!current) {
      return res
        .status(404)
        .json({ success: false, message: "Khong tim thay bai viet" });
    }

    let currentCategories = extractCategorySlugs(current.categories);
    if (currentCategories.length === 0 && current.category) {
      currentCategories = [current.category];
    }

    const baseSlugRoot = getSlugRoot(current.slugId);

    const candidates = await NewsModel.find({
      _id: { $ne: current._id },
    }).limit(50);

    const scored = candidates.map((post) => {
      const candidateRoot = getSlugRoot(post.slugId);
      const slugScore = stringSimilarity.compareTwoStrings(
        baseSlugRoot,
        candidateRoot,
      );

      const candidateCategorySlugs = extractCategorySlugs(post.categories);
      const categoryScore = currentCategories.some((cat) => {
        if (candidateCategorySlugs.includes(cat)) return true;
        if (post.category) return categoryMatchesSlug(post.category, cat);
        return false;
      })
        ? 0.3
        : 0;

      return { post, slugScore, totalScore: slugScore + categoryScore };
    });

    let filtered = scored.filter((item) => item.slugScore >= 0.5);

    if (filtered.length === 0 && currentCategories.length > 0) {
      filtered = scored.filter((item) => item.totalScore > 0.3);
    }

    if (filtered.length === 0) {
      const latestPosts = await NewsModel.find({ _id: { $ne: current._id } })
        .sort({ createdAt: -1 })
        .limit(3);
      return res.json({ success: true, data: latestPosts });
    }

    filtered.sort((a, b) => {
      if (b.slugScore !== a.slugScore) return b.slugScore - a.slugScore;
      return b.totalScore - a.totalScore;
    });

    const related = filtered.map((item) => item.post);

    return res.json({
      success: true,
      message: "Lay bai viet lien quan thanh cong",
      data: related,
    });
  } catch (error) {
    console.error("Loi getRelatedPosts:", error);
    return res.status(500).json({ success: false, message: "Loi he thong" });
  }
};



