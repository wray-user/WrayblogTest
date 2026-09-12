import mongoose from 'mongoose';

const postSchema = new mongoose.Schema(
  {
    title: {
      type: String,
      required: true,
      trim: true,
    },

    content: {
      type: String,
      default: '',
    },

    category: {
      type: String,
      default: 'tech',
    },

    postType: {
      type: String,
      enum: ['note', 'question'],
      default: 'note',
    },

    sortOrder: {
      type: Number,
      default: () => Date.now(),
    },

    access: {
      type: String,
      enum: ['public', 'login', 'private'],
      default: 'public',
    },

    summary: {
      type: String,
      default: '',
      trim: true,
    },

    coverImageUrl: {
      type: String,
      default: '',
    },

    tags: {
      type: [String],
      default: [],
    },

    status: {
      type: String,
      enum: ['draft', 'published', 'scheduled'],
      default: 'draft',
    },

    viewCount: {
      type: Number,
      default: 0,
    },

    commentCount: {
      type: Number,
      default: 0,
    },

    publishedAt: {
      type: Date,
      default: null,
    },

    scheduledAt: {
      type: Date,
      default: null,
    },

    author: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
    },

    assets: [
      {
        type: {
          type: String,
          enum: ['image', 'video', 'audio'],
          required: true,
        },

        assetId: {
          type: mongoose.Schema.Types.ObjectId,
          required: true,
        },

        url: {
          type: String,
          required: true,
        },
      },
    ],
  },
  {
    timestamps: true,
  }
);

export default mongoose.model('Post', postSchema);
