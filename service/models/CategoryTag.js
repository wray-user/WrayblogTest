import mongoose from 'mongoose';

const DEFAULT_TAG_IMAGE =
  'data:image/svg+xml,%3Csvg xmlns=%22http://www.w3.org/2000/svg%22 width=%22320%22 height=%22180%22 viewBox=%220 0 320 180%22%3E%3Cdefs%3E%3ClinearGradient id=%22g%22 x1=%220%22 y1=%220%22 x2=%221%22 y2=%221%22%3E%3Cstop stop-color=%22%23409eff%22/%3E%3Cstop offset=%221%22 stop-color=%22%237c3aed%22/%3E%3C/linearGradient%3E%3C/defs%3E%3Crect width=%22320%22 height=%22180%22 fill=%22url(%23g)%22/%3E%3Ccircle cx=%22255%22 cy=%2235%22 r=%2256%22 fill=%22%23ffffff%22 opacity=%22.18%22/%3E%3Ccircle cx=%2262%22 cy=%22148%22 r=%2274%22 fill=%22%23ffffff%22 opacity=%22.12%22/%3E%3Cpath d=%22M96 72h94c7.7 0 14 6.3 14 14v8c0 4.2-1.9 8.2-5.2 10.9l-55 45.1a14 14 0 0 1-17.8 0l-55-45.1A14 14 0 0 1 66 94v-8c0-7.7 6.3-14 14-14h16Z%22 fill=%22%23fff%22 opacity=%22.92%22/%3E%3Ccircle cx=%2295%22 cy=%2294%22 r=%229%22 fill=%22%23409eff%22/%3E%3C/svg%3E';
const DEFAULT_CATEGORY_TAG_NAME = '默认标签';

const categoryTagSchema = new mongoose.Schema(
  {
    name: {
      type: String,
      required: true,
      trim: true,
      maxlength: 40,
    },

    imageUrl: {
      type: String,
      default: DEFAULT_TAG_IMAGE,
    },

    author: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
      index: true,
    },
  },
  {
    timestamps: true,
  }
);

categoryTagSchema.index({ author: 1, name: 1 }, { unique: true });

export { DEFAULT_CATEGORY_TAG_NAME, DEFAULT_TAG_IMAGE };
export default mongoose.model('CategoryTag', categoryTagSchema);
