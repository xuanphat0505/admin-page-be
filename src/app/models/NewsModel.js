import mongoose from "mongoose";
// Rich text format for formatted content

const richTextSchema = new mongoose.Schema(
  {
    text: { type: String }, // Nội dung văn bản
    bold: { type: Boolean, default: false },
    italic: { type: Boolean, default: false },
    underline: { type: Boolean, default: false },
    link: { type: String, default: "" }, // link nếu có
  },
  { _id: false }
);

const blockSchema = new mongoose.Schema({
  type: {
    type: String,
    enum: ["heading", "paragraph", "image", "list"],
    required: true,
  },
  content: mongoose.Schema.Types.Mixed, // Can be string, array of richText, or object
  // For paragraph: can be string (simple) or array of richTextSchema (formatted)
  // For list: array of strings or array of arrays of richTextSchema
  // For heading: string
  // For image: string (URL)
});

const newsSchema = new mongoose.Schema(
  {
    title: { type: String, required: true },
    thumbnail: { type: String, required: true },
    blocks: { type: [blockSchema], required: true },
    slugId: {
      type: String,
      required: true,
      unique: true,
    },
    category: { type: String, default: "Tin tổng hợp" },
    author: { type: String, default: "Admin" },
    targetSites: { type: [String], default: [] },
  },
  { timestamps: true }
);

const NewsModel = mongoose.model("news", newsSchema);

export default NewsModel;
