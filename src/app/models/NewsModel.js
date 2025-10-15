import mongoose from "mongoose";

// Schema lưu từng đoạn nội dung rich-text (dùng cho đoạn văn và danh sách)
const richTextSchema = new mongoose.Schema(
  {
    text: { type: String, trim: true },
    bold: { type: Boolean, default: false },
    italic: { type: Boolean, default: false },
    underline: { type: Boolean, default: false },
    link: { type: String, trim: true, default: "" },
  },
  { _id: false }
);

// Schema lưu từng block nội dung trong bài viết
const contentBlockSchema = new mongoose.Schema(
  {
    type: {
      type: String,
      enum: ["heading", "paragraph", "image", "list"],
      required: true,
    },
    level: { type: String, enum: ["H1", "H2", "H3"], trim: true },
    text: { type: String, trim: true },
    richText: { type: [richTextSchema], default: undefined },
    items: { type: [[richTextSchema]], default: undefined },
    url: { type: String, trim: true },
    alt: {
      type: String,
      trim: true,
      required: function requiredAlt() {
        return this.type === "image";
      },
    },
    caption: {
      type: String,
      trim: true,
      required: function requiredCaption() {
        return this.type === "image";
      },
    },
  },
  { _id: false }
);

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
    category: { type: String, default: "Tin tổng hợp", trim: true },
    author: { type: String, default: "Admin", trim: true },
    targetSites: { type: [String], default: [] },
    description: {
      type: String,
      maxLength: 300,
      trim: true, // loại bỏ khoảng trắng ở đầu/cuối
    },
  },
  { timestamps: true }
);

const NewsModel = mongoose.model("news", newsSchema);

export default NewsModel;
