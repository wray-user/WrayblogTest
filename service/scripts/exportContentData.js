import dotenv from 'dotenv';
import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
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
const defaultOutputDirectory = path.resolve(scriptDirectory, '../data/content-export');
const outputDirectory = path.resolve(
  process.env.CONTENT_EXPORT_DIR || defaultOutputDirectory
);
const mediaDirectory = path.join(outputDirectory, 'media');

const mediaModels = {
  images: Image,
  videos: Video,
  audios: Audio,
};

const mediaUrlPattern = /\/api\/(images|videos|audios)\/([a-f0-9]{24})/gi;

const asId = (value) => (value ? String(value) : '');

const collectMediaReferences = (references, value, forcedType = '') => {
  if (!value) return;

  if (forcedType && value.assetId && references[`${forcedType}s`]) {
    references[`${forcedType}s`].add(asId(value.assetId));
  }

  const text = typeof value === 'string' ? value : value.url || '';
  for (const match of text.matchAll(mediaUrlPattern)) {
    const [, type, id] = match;
    references[type].add(id);
  }
};

const getFileExtension = (originalName, mimeType) => {
  const originalExtension = path.extname(String(originalName || '')).toLowerCase();
  if (/^\.[a-z0-9]{1,8}$/.test(originalExtension)) {
    return originalExtension;
  }

  const mimeExtension = String(mimeType || '').split('/')[1]?.split(';')[0];
  return mimeExtension && /^[a-z0-9]{1,8}$/i.test(mimeExtension)
    ? `.${mimeExtension.toLowerCase()}`
    : '.bin';
};

const writeJson = async (fileName, value) => {
  await fs.writeFile(
    path.join(outputDirectory, fileName),
    `${JSON.stringify(value, null, 2)}\n`,
    'utf8'
  );
};

const toBuffer = (value) => {
  if (Buffer.isBuffer(value)) return value;
  if (value && typeof value.value === 'function') {
    return Buffer.from(value.value());
  }
  if (value && Buffer.isBuffer(value.buffer)) {
    return Buffer.from(value.buffer);
  }
  return Buffer.from(value || []);
};

const serializeMedia = async (type, document, uploader) => {
  const id = asId(document._id);
  const extension = getFileExtension(document.originalName, document.mimeType);
  const relativePath = path.join('media', type, `${id}${extension}`);
  const absolutePath = path.join(outputDirectory, relativePath);
  const data = toBuffer(document.data);

  if (data.length !== Number(document.size)) {
    throw new Error(
      `Media size mismatch for ${type}/${id}: expected ${document.size}, got ${data.length}.`
    );
  }

  await fs.mkdir(path.dirname(absolutePath), { recursive: true });
  await fs.writeFile(absolutePath, data);

  return {
    id,
    originalName: document.originalName,
    mimeType: document.mimeType,
    size: document.size,
    duration: document.duration || 0,
    uploader: uploader
      ? {
        id: asId(uploader._id),
        username: uploader.username,
        nickname: uploader.nickname || '',
      }
      : null,
    createdAt: document.createdAt,
    updatedAt: document.updatedAt,
    file: relativePath.replaceAll(path.sep, '/'),
  };
};

try {
  await fs.mkdir(outputDirectory, { recursive: true });
  await mongoose.connect(process.env.MONGO_URI, {
    serverSelectionTimeoutMS: 15000,
  });

  const [posts, categoryTags, tags, users] = await Promise.all([
    Post.find().sort({ createdAt: 1 }).lean(),
    CategoryTag.find().sort({ createdAt: 1 }).lean(),
    Tag.find().sort({ createdAt: 1 }).lean(),
    User.find().sort({ createdAt: 1 }).lean(),
  ]);

  const wrayUsers = users.filter((user) => (
    /^wray$/i.test(user.username || '') || /^wray$/i.test(user.nickname || '')
  ));

  if (wrayUsers.length !== 1) {
    throw new Error(`Expected exactly one Wray account, found ${wrayUsers.length}.`);
  }

  const usersById = new Map(users.map((user) => [asId(user._id), user]));
  const references = {
    images: new Set(),
    videos: new Set(),
    audios: new Set(),
  };

  for (const post of posts) {
    collectMediaReferences(references, post.content);
    collectMediaReferences(references, post.coverImageUrl);
    for (const asset of post.assets || []) {
      collectMediaReferences(references, asset, asset.type);
    }
  }

  for (const categoryTag of categoryTags) {
    collectMediaReferences(references, categoryTag.imageUrl);
  }

  collectMediaReferences(references, wrayUsers[0].avatarUrl);

  const media = {};
  const missingMedia = [];

  for (const [type, Model] of Object.entries(mediaModels)) {
    const ids = [...references[type]]
      .filter((id) => mongoose.isValidObjectId(id))
      .map((id) => new mongoose.Types.ObjectId(id));
    const documents = ids.length > 0
      ? await Model.find({ _id: { $in: ids } }).lean()
      : [];
    const foundIds = new Set(documents.map((document) => asId(document._id)));

    for (const id of references[type]) {
      if (!foundIds.has(id)) missingMedia.push(`${type}/${id}`);
    }

    media[type] = await Promise.all(
      documents.map((document) => serializeMedia(
        type,
        document,
        usersById.get(asId(document.uploader))
      ))
    );
  }

  const publicUsers = users.map((user) => ({
    id: asId(user._id),
    username: user.username,
    nickname: user.nickname || '',
    avatarUrl: user.avatarUrl || '',
    role: user.role || 'user',
    createdAt: user.createdAt,
    updatedAt: user.updatedAt,
  }));

  await Promise.all([
    writeJson('users.json', publicUsers),
    writeJson('posts.json', posts),
    writeJson('categoryTags.json', categoryTags),
    writeJson('tags.json', tags),
  ]);

  const manifest = {
    format: 'wrayblog-content-export',
    version: 1,
    exportedAt: new Date().toISOString(),
    database: 'wrayblog',
    includedCollections: ['users-public', 'posts', 'categorytags', 'tags', 'media-referenced'],
    excludedCollections: ['editorbackups', 'visits', 'studyRecords', 'comment'],
    notes: [
      'User password hashes and secrets are intentionally excluded.',
      'Only media referenced by content or the Wray avatar is included.',
      'All exported posts, categories, and tags currently belong to Wray.',
    ],
    counts: {
      users: publicUsers.length,
      posts: posts.length,
      categoryTags: categoryTags.length,
      tags: tags.length,
      images: media.images.length,
      videos: media.videos.length,
      audios: media.audios.length,
    },
    missingMedia,
    media,
  };

  await writeJson('manifest.json', manifest);

  console.log(JSON.stringify({
    outputDirectory,
    counts: manifest.counts,
    missingMedia,
  }, null, 2));
} finally {
  await mongoose.disconnect().catch(() => {});
}
