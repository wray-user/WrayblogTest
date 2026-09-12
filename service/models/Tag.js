import mongoose from 'mongoose';

const DEFAULT_TAG_NAME = '默认标签';

const tagSchema = new mongoose.Schema(
  {
    name: {
      type: String,
      required: true,
      trim: true,
      maxlength: 40,
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

tagSchema.index({ author: 1, name: 1 }, { unique: true });

export { DEFAULT_TAG_NAME };
export default mongoose.model('Tag', tagSchema);
