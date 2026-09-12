import mongoose from 'mongoose';

const editorBackupSchema = new mongoose.Schema(
  {
    editorKey: {
      type: String,
      required: true,
      trim: true,
      index: true,
    },

    title: {
      type: String,
      default: '',
    },

    content: {
      type: String,
      default: '',
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

editorBackupSchema.index({ author: 1, editorKey: 1, createdAt: -1 });

export default mongoose.model('EditorBackup', editorBackupSchema);
