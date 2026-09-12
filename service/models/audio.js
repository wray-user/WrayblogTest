import mongoose from 'mongoose';

const audioSchema = new mongoose.Schema(
  {
    originalName: {
      type: String,
      required: true,
    },

    mimeType: {
      type: String,
      required: true,
    },

    size: {
      type: Number,
      required: true,
    },

    data: {
      type: Buffer,
      required: true,
    },

    duration: {
      type: Number,
      default: 0,
    },

    uploader: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
    },
  },
  {
    timestamps: true,
  }
);

export default mongoose.model('Audio', audioSchema);
