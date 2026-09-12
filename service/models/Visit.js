import mongoose from 'mongoose';

const visitSchema = new mongoose.Schema(
  {
    ip: {
      type: String,
      default: '',
      trim: true,
    },
    path: {
      type: String,
      default: '',
      trim: true,
    },
    pageTitle: {
      type: String,
      default: '',
      trim: true,
    },
    userAgent: {
      type: String,
      default: '',
    },
    referrer: {
      type: String,
      default: '',
    },
    timezone: {
      type: String,
      default: '',
      trim: true,
    },
    country: {
      type: String,
      default: '',
      trim: true,
    },
    region: {
      type: String,
      default: '',
      trim: true,
    },
    city: {
      type: String,
      default: '',
      trim: true,
    },
    latitude: {
      type: Number,
      default: null,
    },
    longitude: {
      type: Number,
      default: null,
    },
    post: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Post',
      default: null,
    },
    postAuthor: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      default: null,
    },
    section: {
      type: String,
      enum: ['tech', 'note', 'study', 'site'],
      default: 'site',
    },
  },
  {
    timestamps: true,
  }
);

visitSchema.index({ createdAt: -1 });
visitSchema.index({ ip: 1, createdAt: -1 });
visitSchema.index({ section: 1, createdAt: -1 });
visitSchema.index({ postAuthor: 1, createdAt: -1 });
visitSchema.index({ post: 1, createdAt: -1 });

export default mongoose.model('Visit', visitSchema);
