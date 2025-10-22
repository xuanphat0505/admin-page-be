import slugify from "slugify";
import CategoryModel from "../models/CategoryModel.js";

const DEFAULT_CATEGORIES = [
  { value: "highlight", label: "Nổi bật" },
  { value: "popular", label: "Được quan tâm" },
  { value: "green-life", label: "Sống xanh" },
  { value: "chat", label: "Chất" },
  { value: "health", label: "Khỏe" },
];

const ensureDefaultCategories = async () => {
  const existing = await CategoryModel.find(
    { value: { $in: DEFAULT_CATEGORIES.map((item) => item.value) } },
    "value",
  ).lean();

  const existingValues = new Set(existing.map((item) => item.value));
  const missing = DEFAULT_CATEGORIES.filter(
    (item) => !existingValues.has(item.value),
  );

  if (missing.length > 0) {
    try {
      await CategoryModel.insertMany(
        missing.map((item) => ({
          value: item.value,
          label: item.label,
          isDefault: true,
        })),
        { ordered: false },
      );
    } catch (error) {
      if (error?.code !== 11000) {
        throw error;
      }
    }
  }
};

export const getCategories = async (_req, res) => {
  try {
    await ensureDefaultCategories();

    const categories = await CategoryModel.find()
      .sort({ isDefault: -1, createdAt: 1 })
      .select("value label isDefault")
      .lean();

    return res.status(200).json({
      success: true,
      message: "Lấy danh sách chuyên mục thành công.",
      data: categories,
    });
  } catch (error) {
    console.error("Lỗi getCategories:", error);
    return res
      .status(500)
      .json({ success: false, message: "Không thể lấy danh sách chuyên mục." });
  }
};

export const createCategory = async (req, res) => {
  try {
    const name = typeof req.body?.name === "string" ? req.body.name.trim() : "";
    if (!name) {
      return res
        .status(400)
        .json({ success: false, message: "Vui lòng nhập tên chuyên mục." });
    }

    const normalizedValue =
      slugify(name, { lower: true, locale: "vi", strict: true }) ||
      name.toLowerCase().replace(/\s+/g, "-");

    const existing = await CategoryModel.findOne({ value: normalizedValue });
    if (existing) {
      return res
        .status(409)
        .json({ success: false, message: "Chuyên mục đã tồn tại." });
    }

    const category = await CategoryModel.create({
      value: normalizedValue,
      label: name,
      isDefault: false,
    });

    return res.status(201).json({
      success: true,
      message: "Tạo chuyên mục thành công.",
      data: {
        value: category.value,
        label: category.label,
        isDefault: category.isDefault,
      },
    });
  } catch (error) {
    console.error("Lỗi createCategory:", error);
    return res
      .status(500)
      .json({ success: false, message: "Không thể tạo chuyên mục mới." });
  }
};
