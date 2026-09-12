import dotenv from 'dotenv';
import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import bcrypt from 'bcryptjs';
import mongoose from 'mongoose';
import User from '../models/User.js';
import Post from '../models/Post.js';
import CategoryTag from '../models/CategoryTag.js';
import Tag from '../models/Tag.js';
import Image from '../models/image.js';
import Video from '../models/video.js';
import Audio from '../models/audio.js';

dotenv.config();

const scriptDirectory = path.dirname(fileURLToPath(import.meta.url));
const defaultInputDirectory = path.resolve(scriptDirectory, '../data/content-export');
const inputDirectory = path.resolve(
  process.env.CONTENT_EXPORT_DIR || defaultInputDirectory
);
const dryRun = process.argv.includes('--dry-run');

const mediaModels = {
  images: Image,
  videos: Video,
  audios: Audio,
};

const readJson = async (fileName) => (
  JSON.parse(await fs.readFile(path.join(inputDirectory, fileName), 'utf8'))
);

const asObjectId = (value) => {
  if (!mongoose.isValidObjectId(value)) {
    throw new Error(`Invalid ObjectId: ${value}`);
  }
  return new mongoose.Types.ObjectId(value);
};

const asDate = (value) => (value ? new Date(value) : null);

const findUserByExportedIdentity = async (user) => (
  User.findOne({
    $or: [
      { username: new RegExp(`^${String(user.username).replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}$`, 'i') },
      { nickname: new RegExp(`^${String(user.nickname).replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}$`, 'i') },
    ],
  })
);

const resolveUserId = (sourceId, usersBySourceId, wrayUser) => (
  usersBySourceId.get(String(sourceId)) || wrayUser?._id || asObjectId(sourceId)
);

const restoreMedia = async (type, entries, usersBySourceId, wrayUser) => {
  const Model = mediaModels[type];
  let count = 0;

  for (const entry of entries) {
    const data = await fs.readFile(path.join(inputDirectory, entry.file));
    const document = {
      _id: asObjectId(entry.id),
      originalName: entry.originalName,
      mimeType: entry.mimeType,
      size: entry.size,
      data,
      uploader: resolveUserId(entry.uploader?.id, usersBySourceId, wrayUser),
      createdAt: asDate(entry.createdAt),
      updatedAt: asDate(entry.updatedAt),
    };

    if (type !== 'images') document.duration = entry.duration || 0;

    if (!dryRun) {
      await Model.collection.replaceOne(
        { _id: document._id },
        document,
        { upsert: true }
      );
    }
    count += 1;
  }

  return count;
};

const restorePost = (post, usersBySourceId, wrayUser) => ({
  _id: asObjectId(post._id),
  title: post.title,
  content: post.content || '',
  category: post.category || 'tech',
  postType: post.postType || 'note',
  sortOrder: post.sortOrder,
  access: post.access || 'public',
  summary: post.summary || '',
  coverImageUrl: post.coverImageUrl || '',
  tags: Array.isArray(post.tags) ? post.tags : [],
  status: post.status || 'draft',
  viewCount: post.viewCount || 0,
  commentCount: post.commentCount || 0,
  publishedAt: asDate(post.publishedAt),
  scheduledAt: asDate(post.scheduledAt),
  author: resolveUserId(post.author, usersBySourceId, wrayUser),
  assets: (post.assets || []).map((asset) => ({
    type: asset.type,
    assetId: asObjectId(asset.assetId),
    url: asset.url,
  })),
  createdAt: asDate(post.createdAt),
  updatedAt: asDate(post.updatedAt),
});

const restoreCategoryTag = (tag, usersBySourceId, wrayUser) => ({
  _id: asObjectId(tag._id),
  name: tag.name,
  imageUrl: tag.imageUrl || '',
  author: resolveUserId(tag.author, usersBySourceId, wrayUser),
  createdAt: asDate(tag.createdAt),
  updatedAt: asDate(tag.updatedAt),
});

const restoreTag = (tag, usersBySourceId, wrayUser) => ({
  _id: asObjectId(tag._id),
  name: tag.name,
  author: resolveUserId(tag.author, usersBySourceId, wrayUser),
  createdAt: asDate(tag.createdAt),
  updatedAt: asDate(tag.updatedAt),
});

try {
  const manifest = await readJson('manifest.json');
  if (manifest.format !== 'wrayblog-content-export') {
    throw new Error('Unsupported content export format.');
  }

  const [users, posts, categoryTags, tags] = await Promise.all([
    readJson('users.json'),
    readJson('posts.json'),
    readJson('categoryTags.json'),
    readJson('tags.json'),
  ]);

  await mongoose.connect(process.env.MONGO_URI, {
    serverSelectionTimeoutMS: 15000,
  });

  const usersBySourceId = new Map();
  let wrayUser = await User.findOne({
    $or: [{ username: /^wray$/i }, { nickname: /^wray$/i }],
  });

  for (const exportedUser of users) {
    const currentUser = await findUserByExportedIdentity(exportedUser);

    if (currentUser) {
      usersBySourceId.set(exportedUser.id, currentUser._id);
      if (!dryRun) {
        await User.updateOne(
          { _id: currentUser._id },
          {
            $set: {
              nickname: exportedUser.nickname || '',
              avatarUrl: exportedUser.avatarUrl || '',
              role: exportedUser.role || 'user',
            },
          }
        );
      }
      if (/^wray$/i.test(exportedUser.username || '') || /^wray$/i.test(exportedUser.nickname || '')) {
        wrayUser = currentUser;
      }
    }
  }

  if (!wrayUser && process.env.WRAY_PASSWORD) {
    if (!dryRun) {
      const passwordHash = await bcrypt.hash(process.env.WRAY_PASSWORD, 12);
      wrayUser = await User.create({
        username: 'Wray',
        nickname: 'Wray',
        avatarUrl: users.find((user) => /^wray$/i.test(user.username || ''))?.avatarUrl || '',
        passwordHash,
        role: 'user',
      });
    } else {
      const exportedWray = users.find((user) => (
        /^wray$/i.test(user.username || '') || /^wray$/i.test(user.nickname || '')
      ));
      wrayUser = { _id: asObjectId(exportedWray?.id) };
    }
  }

  if (!wrayUser) {
    throw new Error(
      'Wray account was not found. Create it first or set WRAY_PASSWORD for import.'
    );
  }

  const mediaCounts = {};
  for (const [type, entries] of Object.entries(manifest.media || {})) {
    mediaCounts[type] = await restoreMedia(type, entries, usersBySourceId, wrayUser);
  }

  const restoredPosts = posts.map((post) => restorePost(post, usersBySourceId, wrayUser));
  const restoredCategoryTags = categoryTags.map((tag) => (
    restoreCategoryTag(tag, usersBySourceId, wrayUser)
  ));
  const restoredTags = tags.map((tag) => restoreTag(tag, usersBySourceId, wrayUser));

  if (!dryRun) {
    for (const document of restoredPosts) {
      await Post.collection.replaceOne({ _id: document._id }, document, { upsert: true });
    }
    for (const document of restoredCategoryTags) {
      await CategoryTag.collection.replaceOne({ _id: document._id }, document, { upsert: true });
    }
    for (const document of restoredTags) {
      await Tag.collection.replaceOne({ _id: document._id }, document, { upsert: true });
    }
  }

  console.log(JSON.stringify({
    inputDirectory,
    dryRun,
    counts: {
      users: users.length,
      posts: restoredPosts.length,
      categoryTags: restoredCategoryTags.length,
      tags: restoredTags.length,
      ...mediaCounts,
    },
  }, null, 2));
} finally {
  await mongoose.disconnect().catch(() => {});
}
