import mongoose from 'mongoose';
const blockSchema = new mongoose.Schema({
  type: {
    type: String,
    enum: ['heading', 'paragraph', 'image', 'list'],
    required: true,
  },
  content: mongoose.Schema.Types.Mixed, // Allow string, object, or array
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
    category: { type: String, default: 'Tin tổng hợp' },
    author: { type: String, default: 'Admin' },
    targetSites: { type: [String], default: [] },
  },
  { timestamps: true }
);

const NewsModel = mongoose.model('news', newsSchema);

export default NewsModel;
