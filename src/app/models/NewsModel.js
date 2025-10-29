import mongoose from "mongoose";
import slugify from "slugify";

const richTextSchema = new mongoose.Schema(
  {
    text: { type: String, trim: true },
    bold: { type: Boolean, default: false },
    italic: { type: Boolean, default: false },
    underline: { type: Boolean, default: false },
    link: { type: String, trim: true, default: "" },
  },
  { _id: false },
);

const contentBlockSchema = new mongoose.Schema(
  {
    type: {
      type: String,
      enum: ["heading", "paragraph", "image", "list"],
      required: true,
    },
    level: { type: String, enum: ["H1", "H2", "H3", "H4", "H5", "H6"], trim: true },
    text: { type: String, trim: true },
    richText: { type: [richTextSchema], default: undefined },
    items: { type: [[richTextSchema]], default: undefined },
    url: { type: String, trim: true },
    alt: {
      type: String,
      trim: true,
      required() {
        return this.type === "image";
      },
    },
    caption: {
      type: String,
      trim: true,
      required() {
        return this.type === "image";
      },
    },
  },
  { _id: false },
);

const categoryEntrySchema = new mongoose.Schema(
  {
    value: { type: String, required: true, trim: true, maxlength: 128 },
    slug: {
      type: String,
      required: true,
      trim: true,
      lowercase: true,
      match: [/^[a-z0-9-]+$/, "Slug chuyen muc khong hop le."],
    },
  },
  { _id: false },
);

const DEFAULT_CATEGORY = { value: "Tin tong hop", slug: "tin-tong-hop" };

const newsSchema = new mongoose.Schema(
  {
    title: { type: String, required: true, trim: true },
    thumbnail: { type: String, required: true, trim: true },
    description: {
      type: String,
      maxLength: 300,
      trim: true,
    },
    content: { type: [contentBlockSchema], required: true },
    slugId: {
      type: String,
      required: true,
      unique: true,
    },
    categories: {
      type: [categoryEntrySchema],
      default: () => [{ ...DEFAULT_CATEGORY }],
      set(value) {
        const input = Array.isArray(value) ? value : [value].filter(Boolean);
        const map = new Map();
        input.forEach((item) => {
          let normalized = null;
          if (typeof item === "string") {
            const label = item.trim();
            if (!label) return;
            const slug = slugify(label, { lower: true, strict: true, locale: "vi", trim: true });
            if (!slug) return;
            normalized = { value: label, slug };
          } else if (item && typeof item === "object") {
            const labelCandidate =
              typeof item.label === "string"
                ? item.label.trim()
                : typeof item.value === "string"
                ? item.value.trim()
                : "";
            const slugSource =
              typeof item.slug === "string" && item.slug.trim()
                ? item.slug.trim()
                : typeof item.value === "string"
                ? item.value.trim()
                : labelCandidate;
            if (!slugSource) return;
            const slug = slugify(slugSource, { lower: true, strict: true, locale: "vi", trim: true });
            if (!slug) return;
            const label = labelCandidate || slug;
            normalized = { value: label, slug };
          }
          if (normalized && !map.has(normalized.slug)) {
            map.set(normalized.slug, normalized);
          }
        });
        const normalizedList = Array.from(map.values());
        return normalizedList.length > 0 ? normalizedList : [{ ...DEFAULT_CATEGORY }];
      },
      validate: {
        validator(value) {
          if (!Array.isArray(value) || value.length === 0) return false;
          const slugs = value
            .map((item) => item?.slug)
            .filter((slug) => typeof slug === "string" && slug.length > 0);
          return slugs.length === value.length && new Set(slugs).size === slugs.length;
        },
        message: "Danh sach chuyen muc khong hop le.",
      },
    },
    author: { type: String, default: "Admin", trim: true },
    targetSites: { type: [String], default: [] },
  },
  { timestamps: true },
);

const NewsModel = mongoose.model("news", newsSchema);

export default NewsModel;



