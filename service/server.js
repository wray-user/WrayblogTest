import express from 'express';
import cors from 'cors';
import mongoose from 'mongoose';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import dotenv from 'dotenv';
import User from './models/User.js';
import auth from './middleware/auth.js';
import multer from 'multer';
import Image from './models/image.js';
import Video from './models/video.js';
import Audio from './models/audio.js';
import EditorBackup from './models/EditorBackup.js';
import Post from './models/Post.js';
import Visit from './models/Visit.js';
import CategoryTag, {
  DEFAULT_CATEGORY_TAG_NAME,
  DEFAULT_TAG_IMAGE,
} from './models/CategoryTag.js';
import Tag, { DEFAULT_TAG_NAME } from './models/Tag.js';

dotenv.config();

const app = express();
app.set('trust proxy', true);

const WRAY_ACCOUNT_PATTERN = /^wray$/i;
const DEFAULT_AVATAR_URL = '/logo/嘟嘟.svg';
const POST_AUTHOR_FIELDS = 'username nickname avatarUrl';

app.use(cors({
  origin: 'http://localhost:5173',
}));

app.use(express.json());

const upload = multer({
  storage: multer.memoryStorage(),

  limits: {
    fileSize: 15 * 1024 * 1024,
  },
});

await mongoose.connect(process.env.MONGO_URI);
console.log('MongoDB connected');

app.get('/api/health', (req, res) => {
  res.json({ ok: true });
});

const signUserToken = (user) => jwt.sign(
  {
    userId: user._id,
    username: user.username,
    role: user.role,
  },
  process.env.JWT_SECRET || 'wray-blog-secret',
  {
    expiresIn: '7d',
  }
);

const serializeUser = (user) => ({
  id: user._id,
  username: user.username,
  nickname: user.nickname || '',
  avatarUrl: user.avatarUrl || '',
  role: user.role || 'user',
  createdAt: user.createdAt,
  updatedAt: user.updatedAt,
});

const getWrayUser = async () => {
  const users = await User.find({
    $or: [
      { username: WRAY_ACCOUNT_PATTERN },
      { nickname: WRAY_ACCOUNT_PATTERN },
    ],
  }).select('_id username nickname avatarUrl role');

  if (users.length !== 1) {
    throw new Error(`Wray账号数量应为1，当前为${users.length}`);
  }

  return users[0];
};

const isAdminUser = async (userId) => {
  const user = await User.findById(userId).select('role');
  return user?.role === 'admin';
};

const isAdminRequest = async (req) => (
  Boolean(req.user?.userId) && isAdminUser(req.user.userId)
);

const getOwnerFilter = async (req, field = 'author') => (
  await isAdminRequest(req)
    ? {}
    : { [field]: req.user.userId }
);

const getOptionalUser = (req) => {
  const header = req.headers.authorization;

  if (!header || !header.startsWith('Bearer ')) {
    return null;
  }

  try {
    return jwt.verify(header.replace('Bearer ', ''), process.env.JWT_SECRET);
  } catch {
    return null;
  }
};

const SECTION_LABELS = {
  tech: '技术分享',
  note: '心情随笔',
  study: '学习记录',
  site: '站点访问',
};

const getPostSection = (postOrCategory = '') => {
  const category = typeof postOrCategory === 'string'
    ? postOrCategory
    : postOrCategory?.category;

  if (category === '心情随笔') return 'note';
  if (category === '学习记录') return 'study';

  return 'tech';
};

const getSectionFromPath = (path = '') => {
  const pathname = String(path || '').split('?')[0];

  if (pathname.startsWith('/tech')) return 'tech';
  if (pathname.startsWith('/mood')) return 'note';
  if (pathname.startsWith('/study')) return 'study';

  return 'site';
};

const normalizeIp = (value = '') => {
  const ip = String(value || '')
    .split(',')[0]
    .trim()
    .replace(/^::ffff:/, '');

  if (!ip || ip === '::1') return '127.0.0.1';

  return ip;
};

const getClientIp = (req) => normalizeIp(
  req.headers['x-forwarded-for']
    || req.headers['x-real-ip']
    || req.ip
    || req.socket?.remoteAddress
);

const parseCoordinate = (value, min, max) => {
  const number = Number(value);

  if (!Number.isFinite(number) || number < min || number > max) {
    return null;
  }

  return number;
};

const safeDecodeHeader = (value = '') => {
  const text = String(value || '').trim();

  try {
    return decodeURIComponent(text);
  } catch {
    return text;
  }
};

const getGeoFromHeaders = (req) => ({
  country: String(req.headers['cf-ipcountry'] || req.headers['x-vercel-ip-country'] || '').trim(),
  region: String(req.headers['x-vercel-ip-country-region'] || req.headers['x-geo-region'] || '').trim(),
  city: safeDecodeHeader(req.headers['x-vercel-ip-city'] || req.headers['x-geo-city']),
  latitude: parseCoordinate(
    req.headers['x-vercel-ip-latitude'] || req.headers['x-geo-latitude'],
    -90,
    90
  ),
  longitude: parseCoordinate(
    req.headers['x-vercel-ip-longitude'] || req.headers['x-geo-longitude'],
    -180,
    180
  ),
});

app.post('/api/auth/login', async (req, res) => {
  const { username, password } = req.body;

  const user = await User.findOne({ username });

  if (!user) {
    return res.status(401).json({ message: '账号或密码错误' });
  }

  const matched = await bcrypt.compare(password, user.passwordHash);

  if (!matched) {
    return res.status(401).json({ message: '账号或密码错误' });
  }

  const token = signUserToken(user);

  res.json({
    token,
    user: serializeUser(user),
  });
});

app.get('/api/profile', auth, async (req, res) => {
  try {
    const user = await User.findById(req.user.userId);

    if (!user) {
      return res.status(404).json({ message: '用户不存在' });
    }

    res.json({ user: serializeUser(user) });
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: '读取个人资料失败' });
  }
});

app.put('/api/profile', auth, async (req, res) => {
  try {
    const user = await User.findById(req.user.userId);

    if (!user) {
      return res.status(404).json({ message: '用户不存在' });
    }

    const username = String(req.body.username || '').trim();
    const nickname = String(req.body.nickname || '').trim();
    const avatarUrl = String(req.body.avatarUrl || '').trim();
    const currentPassword = String(req.body.currentPassword || '');
    const newPassword = String(req.body.newPassword || '');

    if (!username) {
      return res.status(400).json({ message: '请输入账户名' });
    }

    const duplicateUser = await User.findOne({
      username,
      _id: { $ne: user._id },
    });

    if (duplicateUser) {
      return res.status(409).json({ message: '账户名已存在' });
    }

    if (newPassword) {
      if (newPassword.length < 6) {
        return res.status(400).json({ message: '新密码至少 6 位' });
      }

      const matched = await bcrypt.compare(currentPassword, user.passwordHash);

      if (!matched) {
        return res.status(400).json({ message: '当前密码不正确' });
      }

      user.passwordHash = await bcrypt.hash(newPassword, 10);
    }

    user.username = username;
    user.nickname = nickname;
    user.avatarUrl = avatarUrl;
    await user.save();

    res.json({
      message: '个人资料已更新',
      token: signUserToken(user),
      user: serializeUser(user),
    });
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: '保存个人资料失败' });
  }
});

app.get('/api/users', auth, async (req, res) => {
  try {
    if (!await isAdminUser(req.user.userId)) {
      return res.status(403).json({ message: '只有管理员可以管理用户' });
    }

    const users = await User.find().sort({ role: 1, createdAt: -1 });

    res.json({
      users: users.map(serializeUser),
    });
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: '读取用户列表失败' });
  }
});

app.post('/api/users', auth, async (req, res) => {
  try {
    if (!await isAdminUser(req.user.userId)) {
      return res.status(403).json({ message: '只有管理员可以新增用户' });
    }

    const username = String(req.body.username || '').trim();
    const nickname = String(req.body.nickname || '').trim();
    const password = String(req.body.password || '');
    const role = req.body.role === 'admin' ? 'admin' : 'user';

    if (!username || !password) {
      return res.status(400).json({ message: '请输入账户名和密码' });
    }

    if (password.length < 6) {
      return res.status(400).json({ message: '密码至少 6 位' });
    }

    const existingUser = await User.findOne({ username });

    if (existingUser) {
      return res.status(409).json({ message: '账户名已存在' });
    }

    const user = await User.create({
      username,
      nickname,
      role,
      passwordHash: await bcrypt.hash(password, 10),
    });

    res.status(201).json({
      message: '用户已创建',
      user: serializeUser(user),
    });
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: '新增用户失败' });
  }
});

app.put('/api/users/:id', auth, async (req, res) => {
  try {
    if (!await isAdminUser(req.user.userId)) {
      return res.status(403).json({ message: '只有管理员可以编辑用户' });
    }

    const user = await User.findById(req.params.id);

    if (!user) {
      return res.status(404).json({ message: '用户不存在' });
    }

    const username = String(req.body.username || '').trim();
    const nickname = String(req.body.nickname || '').trim();
    const password = String(req.body.password || '');
    const role = req.body.role === 'admin' ? 'admin' : 'user';

    if (!username) {
      return res.status(400).json({ message: '请输入账户名' });
    }

    const duplicateUser = await User.findOne({
      username,
      _id: { $ne: user._id },
    });

    if (duplicateUser) {
      return res.status(409).json({ message: '账户名已存在' });
    }

    if (password && password.length < 6) {
      return res.status(400).json({ message: '密码至少 6 位' });
    }

    if (user.role === 'admin' && role !== 'admin') {
      const adminCount = await User.countDocuments({ role: 'admin' });

      if (adminCount <= 1) {
        return res.status(400).json({ message: '至少保留一个管理员账号' });
      }
    }

    user.username = username;
    user.nickname = nickname;
    user.role = role;

    if (password) {
      user.passwordHash = await bcrypt.hash(password, 10);
    }

    await user.save();

    res.json({
      message: '用户已更新',
      user: serializeUser(user),
      ...(String(user._id) === String(req.user.userId)
        ? { token: signUserToken(user) }
        : {}),
    });
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: '编辑用户失败' });
  }
});

app.delete('/api/users/:id', auth, async (req, res) => {
  try {
    if (!await isAdminUser(req.user.userId)) {
      return res.status(403).json({ message: '只有管理员可以删除用户' });
    }

    if (String(req.params.id) === String(req.user.userId)) {
      return res.status(400).json({ message: '不能删除当前登录的管理员账号' });
    }

    const user = await User.findById(req.params.id);

    if (!user) {
      return res.status(404).json({ message: '用户不存在' });
    }

    const adminCount = await User.countDocuments({ role: 'admin' });

    if (user.role === 'admin' && adminCount <= 1) {
      return res.status(400).json({ message: '至少保留一个管理员账号' });
    }

    await Promise.all([
      Post.deleteMany({ author: user._id }),
      CategoryTag.deleteMany({ author: user._id }),
      Tag.deleteMany({ author: user._id }),
      EditorBackup.deleteMany({ author: user._id }),
      Image.deleteMany({ uploader: user._id }),
      Video.deleteMany({ uploader: user._id }),
      Audio.deleteMany({ uploader: user._id }),
      user.deleteOne(),
    ]);

    res.json({ message: '用户已删除' });
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: '删除用户失败' });
  }
});
app.post('/api/editor-backups', auth, async (req, res) => {
  try {
    const { editorKey = 'main-editor', title = '', content = '' } = req.body;

    const backup = await EditorBackup.create({
      editorKey,
      title,
      content,
      author: req.user.userId,
    });

    res.status(201).json({
      message: '备份已保存',
      backup: {
        id: backup._id,
        title: backup.title,
        createdAt: backup.createdAt,
      },
    });
  } catch (error) {
    console.error(error);

    res.status(500).json({
      message: '保存备份失败',
    });
  }
});

app.get('/api/editor-backups', auth, async (req, res) => {
  try {
    const editorKey = req.query.editorKey || 'main-editor';
    const ownerFilter = await getOwnerFilter(req);
    const backups = await EditorBackup.find({
      editorKey,
      ...ownerFilter,
    })
      .sort({ createdAt: -1 })
      .limit(80)
      .select('_id title createdAt');

    res.json({
      backups: backups.map((backup) => ({
        id: backup._id,
        title: backup.title,
        createdAt: backup.createdAt,
      })),
    });
  } catch (error) {
    console.error(error);

    res.status(500).json({
      message: '读取备份列表失败',
    });
  }
});

app.get('/api/editor-backups/:id', auth, async (req, res) => {
  try {
    const ownerFilter = await getOwnerFilter(req);
    const backup = await EditorBackup.findOne({
      _id: req.params.id,
      ...ownerFilter,
    });

    if (!backup) {
      return res.status(404).json({
        message: '备份不存在',
      });
    }

    res.json({
      backup: {
        id: backup._id,
        title: backup.title,
        content: backup.content,
        createdAt: backup.createdAt,
      },
    });
  } catch (error) {
    console.error(error);

    res.status(500).json({
      message: '读取备份详情失败',
    });
  }
});

app.delete('/api/editor-backups/:id', auth, async (req, res) => {
  try {
    const ownerFilter = await getOwnerFilter(req);
    const backup = await EditorBackup.findOneAndDelete({
      _id: req.params.id,
      ...ownerFilter,
    });

    if (!backup) {
      return res.status(404).json({
        message: '备份不存在',
      });
    }

    res.json({
      message: '备份已删除',
    });
  } catch (error) {
    console.error(error);

    res.status(500).json({
      message: '删除备份失败',
    });
  }
});

const getTagPostQuery = (name, author) => ({
  author,
  $or: [
    { category: name },
    { tags: name },
  ],
});

const serializeCategoryTag = async (tag) => {
  const articleCount = await Post.countDocuments(
    getTagPostQuery(tag.name, tag.author)
  );

  return {
    id: tag._id,
    name: tag.name,
    imageUrl: tag.imageUrl || DEFAULT_TAG_IMAGE,
    articleCount,
    createdAt: tag.createdAt,
    updatedAt: tag.updatedAt,
  };
};

const movePostsToTagName = async (fromName, toName, author) => {
  const posts = await Post.find(getTagPostQuery(fromName, author));

  await Promise.all(posts.map((post) => {
    if (post.category === fromName) {
      post.category = toName;
    }

    if (post.tags.includes(fromName)) {
      post.tags = post.tags.filter((name) => name !== fromName);

      if (!post.tags.includes(toName)) {
        post.tags.push(toName);
      }
    }

    return post.save();
  }));

  return posts.length;
};

const movePostsToDefaultTag = (tagName, author) =>
  movePostsToTagName(tagName, DEFAULT_CATEGORY_TAG_NAME, author);

app.get('/api/category-tags', async (req, res) => {
  try {
    const user = getOptionalUser(req);
    const query = {
      name: { $ne: DEFAULT_CATEGORY_TAG_NAME },
    };

    if (user && !(await isAdminUser(user.userId))) {
      query.author = user.userId;
    }

    const tags = await CategoryTag.find(query).sort({ createdAt: 1 });

    const result = await Promise.all(tags.map(serializeCategoryTag));

    res.json({
      tags: result,
    });
  } catch (error) {
    console.error(error);

    res.status(500).json({
      message: '读取分类标签失败',
    });
  }
});

app.post('/api/category-tags', auth, async (req, res) => {
  try {
    const name = String(req.body.name || '').trim();
    const imageUrl = String(req.body.imageUrl || DEFAULT_TAG_IMAGE).trim();

    if (!name) {
      return res.status(400).json({
        message: "分类标签名称不能为空",
      });
    }

    if (name === DEFAULT_CATEGORY_TAG_NAME) {
      return res.status(400).json({
        message: '默认分类标签不能修改',
      });
    }

    const tag = await CategoryTag.create({
      name,
      imageUrl: imageUrl || DEFAULT_TAG_IMAGE,
      author: req.user.userId,
    });

    res.status(201).json({
      message: '分类标签已创建',
      tag: await serializeCategoryTag(tag),
    });
  } catch (error) {
    console.error(error);

    if (error.code === 11000) {
      return res.status(409).json({
        message: '分类标签已存在',
      });
    }

    res.status(500).json({
      message: '创建分类标签失败',
    });
  }
});

app.get('/api/category-tags/:id', auth, async (req, res) => {
  try {
    const ownerFilter = await getOwnerFilter(req);
    const tag = await CategoryTag.findOne({
      _id: req.params.id,
      ...ownerFilter,
    });

    if (!tag) {
      return res.status(404).json({
        message: '分类标签不存在',
      });
    }

    const posts = await Post.find(getTagPostQuery(tag.name, tag.author))
      .sort({ updatedAt: -1 })
      .select('_id title category tags status updatedAt createdAt')
      .limit(80);

    res.json({
      tag: await serializeCategoryTag(tag),
      posts: posts.map((post) => ({
        id: post._id,
        title: post.title,
        category: post.category,
        tags: post.tags,
        status: post.status,
        updatedAt: post.updatedAt,
        createdAt: post.createdAt,
      })),
    });
  } catch (error) {
    console.error(error);

    res.status(500).json({
      message: '读取分类标签详情失败',
    });
  }
});

app.put('/api/category-tags/:id', auth, async (req, res) => {
  try {
    const name = String(req.body.name || '').trim();
    const imageUrl = String(req.body.imageUrl || DEFAULT_TAG_IMAGE).trim();

    if (!name) {
      return res.status(400).json({
        message: "分类标签名称不能为空",
      });
    }

    if (name === DEFAULT_CATEGORY_TAG_NAME) {
      return res.status(400).json({
        message: '默认分类标签不能修改',
      });
    }

    const ownerFilter = await getOwnerFilter(req);
    const tag = await CategoryTag.findOne({
      _id: req.params.id,
      ...ownerFilter,
    });

    if (!tag) {
      return res.status(404).json({
        message: '分类标签不存在',
      });
    }

    if (name !== tag.name) {
      const existedTag = await CategoryTag.findOne({
        _id: { $ne: tag._id },
        author: tag.author,
        name,
      });

      if (existedTag) {
        return res.status(409).json({
          message: '分类标签已存在',
        });
      }

      await movePostsToTagName(tag.name, name, tag.author);
    }

    tag.name = name;
    tag.imageUrl = imageUrl || DEFAULT_TAG_IMAGE;
    await tag.save();

    res.json({
      message: '分类标签已更新',
      tag: await serializeCategoryTag(tag),
    });
  } catch (error) {
    console.error(error);

    if (error.code === 11000) {
      return res.status(409).json({
        message: '分类标签已存在',
      });
    }

    res.status(500).json({
      message: '更新分类标签失败',
    });
  }
});

app.delete('/api/category-tags/:id', auth, async (req, res) => {
  try {
    const ownerFilter = await getOwnerFilter(req);
    const tag = await CategoryTag.findOne({
      _id: req.params.id,
      ...ownerFilter,
    });

    if (!tag) {
      return res.status(404).json({
        message: '分类标签不存在',
      });
    }

    if (tag.name === DEFAULT_CATEGORY_TAG_NAME) {
      return res.status(400).json({
        message: '默认分类标签不能删除',
      });
    }

    const movedCount = await movePostsToDefaultTag(tag.name, tag.author);

    await tag.deleteOne();

    res.json({
      message: '分类标签已删除',
      movedCount,
    });
  } catch (error) {
    console.error(error);

    res.status(500).json({
      message: '删除分类标签失败',
    });
  }
});

const getPostTagQuery = (name, author) => ({
  author,
  tags: name,
});

const serializeTag = async (tag) => {
  const articleCount = await Post.countDocuments(
    getPostTagQuery(tag.name, tag.author)
  );

  return {
    id: tag._id,
    name: tag.name,
    articleCount,
    createdAt: tag.createdAt,
    updatedAt: tag.updatedAt,
  };
};

const movePostTagName = async (fromName, toName, author) => {
  const posts = await Post.find(getPostTagQuery(fromName, author));

  await Promise.all(posts.map((post) => {
    post.tags = post.tags.filter((name) => name !== fromName);

    if (!post.tags.includes(toName)) {
      post.tags.push(toName);
    }

    return post.save();
  }));

  return posts.length;
};

app.get('/api/tags', async (req, res) => {
  try {
    const user = getOptionalUser(req);
    const query = {
      name: { $ne: DEFAULT_TAG_NAME },
    };

    if (user && !(await isAdminUser(user.userId))) {
      query.author = user.userId;
    }

    const tags = await Tag.find(query).sort({ createdAt: 1 });

    const result = await Promise.all(tags.map(serializeTag));

    res.json({
      tags: result,
    });
  } catch (error) {
    console.error(error);

    res.status(500).json({
      message: '读取标签失败',
    });
  }
});

app.post('/api/tags', auth, async (req, res) => {
  try {
    const name = String(req.body.name || '').trim();

    if (!name) {
      return res.status(400).json({
        message: '标签名称不能为空',
      });
    }

    if (name === DEFAULT_TAG_NAME) {
      return res.status(400).json({
        message: '默认标签不能修改',
      });
    }

    const tag = await Tag.create({
      name,
      author: req.user.userId,
    });

    res.status(201).json({
      message: '标签已创建',
      tag: await serializeTag(tag),
    });
  } catch (error) {
    console.error(error);

    if (error.code === 11000) {
      return res.status(409).json({
        message: '标签已存在',
      });
    }

    res.status(500).json({
      message: '创建标签失败',
    });
  }
});

app.get('/api/tags/:id', auth, async (req, res) => {
  try {
    const ownerFilter = await getOwnerFilter(req);
    const tag = await Tag.findOne({
      _id: req.params.id,
      ...ownerFilter,
    });

    if (!tag) {
      return res.status(404).json({
        message: '标签不存在',
      });
    }

    const posts = await Post.find(getPostTagQuery(tag.name, tag.author))
      .sort({ updatedAt: -1 })
      .select('_id title category tags status updatedAt createdAt')
      .limit(80);

    res.json({
      tag: await serializeTag(tag),
      posts: posts.map((post) => ({
        id: post._id,
        title: post.title,
        category: post.category,
        tags: post.tags,
        status: post.status,
        updatedAt: post.updatedAt,
        createdAt: post.createdAt,
      })),
    });
  } catch (error) {
    console.error(error);

    res.status(500).json({
      message: '读取标签详情失败',
    });
  }
});

app.put('/api/tags/:id', auth, async (req, res) => {
  try {
    const name = String(req.body.name || '').trim();

    if (!name) {
      return res.status(400).json({
        message: '标签名称不能为空',
      });
    }

    if (name === DEFAULT_TAG_NAME) {
      return res.status(400).json({
        message: '默认标签不能修改',
      });
    }

    const ownerFilter = await getOwnerFilter(req);
    const tag = await Tag.findOne({
      _id: req.params.id,
      ...ownerFilter,
    });

    if (!tag) {
      return res.status(404).json({
        message: '标签不存在',
      });
    }

    if (name !== tag.name) {
      const existedTag = await Tag.findOne({
        _id: { $ne: tag._id },
        author: tag.author,
        name,
      });

      if (existedTag) {
        return res.status(409).json({
          message: '标签已存在',
        });
      }

      await movePostTagName(tag.name, name, tag.author);
    }

    tag.name = name;
    await tag.save();

    res.json({
      message: '标签已更新',
      tag: await serializeTag(tag),
    });
  } catch (error) {
    console.error(error);

    if (error.code === 11000) {
      return res.status(409).json({
        message: '标签已存在',
      });
    }

    res.status(500).json({
      message: '更新标签失败',
    });
  }
});

app.delete('/api/tags/:id', auth, async (req, res) => {
  try {
    const ownerFilter = await getOwnerFilter(req);
    const tag = await Tag.findOne({
      _id: req.params.id,
      ...ownerFilter,
    });

    if (!tag) {
      return res.status(404).json({
        message: '标签不存在',
      });
    }

    if (tag.name === DEFAULT_TAG_NAME) {
      return res.status(400).json({
        message: '默认标签不能删除',
      });
    }

    const movedCount = await movePostTagName(
      tag.name,
      DEFAULT_TAG_NAME,
      tag.author
    );

    await tag.deleteOne();

    res.json({
      message: '标签已删除',
      movedCount,
    });
  } catch (error) {
    console.error(error);

    res.status(500).json({
      message: '删除标签失败',
    });
  }
});

const createPostSummary = (content = '') => {
  const text = String(content || '')
    .replace(/<!--[^]*?-->/g, ' ')
    .replace(/<img\b[^>]*>/gi, ' ')
    .replace(/<[^>]*>/g, ' ')
    .replace(/!\[[^\]]*]\([^)]+\)/g, ' ')
    .replace(/\[[^\]]+]\([^)]+\)/g, ' ')
    .replace(/&nbsp;/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();

  if (!text) {
    return '';
  }

  const excerptLimit = 72;
  const chineseRange = /[\u4e00-\u9fff]/;
  const englishWord = /^[A-Za-z0-9]+(?:'[A-Za-z0-9]+)*/;
  const parts = [];
  let index = 0;
  let tokenCount = 0;

  while (index < text.length && tokenCount < excerptLimit) {
    const char = text[index];

    if (/\s/.test(char)) {
      if (parts.length && parts[parts.length - 1] !== ' ') {
        parts.push(' ');
      }
      index += 1;
      continue;
    }

    const wordMatch = text.slice(index).match(englishWord);
    if (wordMatch) {
      const word = wordMatch[0];
      parts.push(word);
      tokenCount += 1;
      index += word.length;
      continue;
    }

    if (chineseRange.test(char)) {
      parts.push(char);
      tokenCount += 1;
      index += 1;
      continue;
    }

    parts.push(char);
    index += 1;
  }

  const excerpt = parts.join('').replace(/\s+([,.;:!?])/g, '$1').trim();
  return index < text.length ? `${excerpt}...` : excerpt;
};

const getCategoryCoverImage = async (category, author) => {
  if (!String(category || '').trim()) {
    return DEFAULT_TAG_IMAGE;
  }

  const categoryTag = await CategoryTag.findOne({
    name: String(category).trim(),
    author,
  }).select('imageUrl');

  return categoryTag?.imageUrl || DEFAULT_TAG_IMAGE;
};

const normalizePostPayload = async (body, author, existingPost = null) => {
  const title = String(body.title || '').trim();
  const content = String(body.content || '');
  const category = String(body.category || '').trim();
  const postType = body.postType === 'question' ? 'question' : 'note';
  const accessOptions = ['public', 'login', 'private'];
  const access = accessOptions.includes(body.access) ? body.access : 'public';
  const statusOptions = ['draft', 'published', 'scheduled'];
  const status = statusOptions.includes(body.status) ? body.status : 'draft';
  const tags = Array.isArray(body.tags)
    ? [...new Set(body.tags.map((tag) => String(tag).trim()).filter(Boolean))]
    : [];
  const summary = String(body.summary || '').trim() || createPostSummary(content);
  const coverImageUrl = String(body.coverImageUrl || '').trim()
    || await getCategoryCoverImage(category, author);
  const scheduledAt = body.scheduledAt ? new Date(body.scheduledAt) : null;

  const validScheduledAt = Number.isNaN(scheduledAt?.getTime()) ? null : scheduledAt;

  const existingPublishedAt = existingPost?.publishedAt || null;
  const nextPublishedAt = status === 'published'
    ? existingPublishedAt || new Date()
    : status === 'scheduled'
      ? existingPublishedAt || validScheduledAt
      : existingPublishedAt;
  const nextSortOrder = existingPublishedAt
    ? existingPost?.sortOrder ?? existingPublishedAt.getTime()
    : status === 'published' || status === 'scheduled'
      ? nextPublishedAt?.getTime()
      : existingPost?.sortOrder;

  return {
    title,
    content,
    category,
    postType,
    access,
    summary,
    coverImageUrl,
    tags,
    status,
    sortOrder: nextSortOrder ?? Date.now(),
    scheduledAt: validScheduledAt,
    publishedAt: nextPublishedAt,
  };
};

const serializePost = (post) => {
  const author = post.author && typeof post.author === 'object'
    ? {
        id: post.author._id,
        username: post.author.username || '未知用户',
        nickname: post.author.nickname || '',
        avatarUrl: post.author.avatarUrl || DEFAULT_AVATAR_URL,
      }
    : {
        id: null,
        username: 'Wray',
        nickname: 'Wray',
        avatarUrl: DEFAULT_AVATAR_URL,
      };

  return {
    id: post._id,
    title: post.title,
    content: post.content,
    category: post.category,
    postType: post.postType || 'note',
    sortOrder: post.sortOrder ?? 0,
    access: post.access || 'public',
    summary: post.summary || '',
    coverImageUrl: post.coverImageUrl || '',
    tags: post.tags,
    status: post.status,
    viewCount: post.viewCount || 0,
    commentCount: post.commentCount || 0,
    author,
    publishedAt: post.publishedAt,
    scheduledAt: post.scheduledAt,
    createdAt: post.createdAt,
    updatedAt: post.updatedAt,
  };
};

const createEmptySectionStats = () => ({
  tech: {
    key: 'tech',
    label: SECTION_LABELS.tech,
    posts: 0,
    published: 0,
    drafts: 0,
    scheduled: 0,
    views: 0,
    comments: 0,
    visits: 0,
  },
  note: {
    key: 'note',
    label: SECTION_LABELS.note,
    posts: 0,
    published: 0,
    drafts: 0,
    scheduled: 0,
    views: 0,
    comments: 0,
    visits: 0,
  },
  study: {
    key: 'study',
    label: SECTION_LABELS.study,
    posts: 0,
    published: 0,
    drafts: 0,
    scheduled: 0,
    views: 0,
    comments: 0,
    visits: 0,
  },
});

const formatDashboardDateKey = (date) => {
  const pad = (value) => String(value).padStart(2, '0');

  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;
};

const buildDateKeys = (days = 14) => {
  const today = new Date();
  today.setHours(0, 0, 0, 0);

  return Array.from({ length: days }, (_, index) => {
    const date = new Date(today);
    date.setDate(today.getDate() - (days - index - 1));

    return formatDashboardDateKey(date);
  });
};

app.post('/api/visits', async (req, res) => {
  try {
    const path = String(req.body.path || '').trim().slice(0, 500);
    const pageTitle = String(req.body.pageTitle || '').trim().slice(0, 200);

    if (!path || path.startsWith('/admin') || path.startsWith('/login')) {
      return res.json({ ok: true, skipped: true });
    }

    const postId = String(req.body.postId || '').trim();
    let post = null;

    if (postId && mongoose.Types.ObjectId.isValid(postId)) {
      post = await Post.findOne({
        _id: postId,
        status: 'published',
        access: 'public',
      }).select('_id author category');
    }

    const geo = getGeoFromHeaders(req);

    await Visit.create({
      ip: getClientIp(req),
      path,
      pageTitle,
      userAgent: String(req.headers['user-agent'] || '').slice(0, 800),
      referrer: String(req.headers.referer || req.headers.referrer || '').slice(0, 800),
      timezone: String(req.body.timezone || '').trim().slice(0, 100),
      ...geo,
      post: post?._id || null,
      postAuthor: post?.author || null,
      section: post ? getPostSection(post) : getSectionFromPath(path),
    });

    res.status(201).json({ ok: true });
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: '记录访问失败' });
  }
});

app.get('/api/dashboard', auth, async (req, res) => {
  try {
    const admin = await isAdminUser(req.user.userId);
    const userObjectId = new mongoose.Types.ObjectId(req.user.userId);
    const postQuery = admin ? {} : { author: req.user.userId };
    const visitQuery = admin ? {} : { postAuthor: req.user.userId };
    const visitMatch = admin ? {} : { postAuthor: userObjectId };
    const postMatch = admin ? {} : { author: userObjectId };
    const dateKeys = buildDateKeys(14);
    const trendStart = new Date(`${dateKeys[0]}T00:00:00+08:00`);

    const [
      posts,
      userCount,
      visitCount,
      uniqueIps,
      visitTrend,
      postTrend,
      visitSectionStats,
      recentVisits,
    ] = await Promise.all([
      Post.find(postQuery)
        .select('title category postType status viewCount commentCount publishedAt createdAt updatedAt author')
        .sort({ updatedAt: -1 })
        .lean(),
      admin ? User.countDocuments() : Promise.resolve(0),
      Visit.countDocuments(visitQuery),
      Visit.distinct('ip', visitQuery),
      Visit.aggregate([
        { $match: { ...visitMatch, createdAt: { $gte: trendStart } } },
        {
          $group: {
            _id: { $dateToString: { format: '%Y-%m-%d', date: '$createdAt', timezone: '+08:00' } },
            visits: { $sum: 1 },
          },
        },
      ]),
      Post.aggregate([
        { $match: { ...postMatch, createdAt: { $gte: trendStart } } },
        {
          $group: {
            _id: { $dateToString: { format: '%Y-%m-%d', date: '$createdAt', timezone: '+08:00' } },
            posts: { $sum: 1 },
          },
        },
      ]),
      Visit.aggregate([
        { $match: visitMatch },
        {
          $group: {
            _id: '$section',
            visits: { $sum: 1 },
          },
        },
      ]),
      Visit.find(visitQuery)
        .select('ip path pageTitle country region city latitude longitude section createdAt')
        .sort({ createdAt: -1 })
        .limit(500)
        .lean(),
    ]);

    const sections = createEmptySectionStats();
    const categoryMap = new Map();

    posts.forEach((post) => {
      const section = getPostSection(post);
      const stats = sections[section] || sections.tech;
      const views = Number(post.viewCount || 0);
      const comments = Number(post.commentCount || 0);

      stats.posts += 1;
      stats.views += views;
      stats.comments += comments;

      if (post.status === 'published') stats.published += 1;
      if (post.status === 'draft') stats.drafts += 1;
      if (post.status === 'scheduled') stats.scheduled += 1;

      if (section === 'tech') {
        const name = post.category || '未分类';
        const current = categoryMap.get(name) || { name, count: 0, views: 0 };
        current.count += 1;
        current.views += views;
        categoryMap.set(name, current);
      }
    });

    visitSectionStats.forEach((item) => {
      if (sections[item._id]) {
        sections[item._id].visits = Number(item.visits || 0);
      }
    });

    const visitTrendMap = new Map(visitTrend.map((item) => [item._id, item.visits]));
    const postTrendMap = new Map(postTrend.map((item) => [item._id, item.posts]));
    const trend = dateKeys.map((date) => ({
      date,
      visits: visitTrendMap.get(date) || 0,
      posts: postTrendMap.get(date) || 0,
    }));

    const visitorMap = new Map();
    recentVisits.forEach((visit) => {
      const ip = visit.ip || '未知 IP';
      const current = visitorMap.get(ip) || {
        ip,
        count: 0,
        country: visit.country || '',
        region: visit.region || '',
        city: visit.city || '',
        latitude: Number.isFinite(visit.latitude) ? visit.latitude : null,
        longitude: Number.isFinite(visit.longitude) ? visit.longitude : null,
        lastPath: visit.path || '',
        pageTitle: visit.pageTitle || '',
        section: visit.section || 'site',
        lastSeenAt: visit.createdAt,
      };

      current.count += 1;
      visitorMap.set(ip, current);
    });

    const visitors = Array.from(visitorMap.values())
      .sort((a, b) => new Date(b.lastSeenAt).getTime() - new Date(a.lastSeenAt).getTime())
      .slice(0, 80);

    const topPosts = posts
      .slice()
      .sort((a, b) => Number(b.viewCount || 0) - Number(a.viewCount || 0))
      .slice(0, 8)
      .map((post) => ({
        id: post._id,
        title: post.title,
        section: getPostSection(post),
        category: post.category || '',
        views: Number(post.viewCount || 0),
        comments: Number(post.commentCount || 0),
        status: post.status,
      }));

    const sectionList = Object.values(sections);
    const summary = {
      visitors: uniqueIps.filter(Boolean).length,
      visits: visitCount,
      posts: posts.length,
      published: posts.filter((post) => post.status === 'published').length,
      drafts: posts.filter((post) => post.status === 'draft').length,
      scheduled: posts.filter((post) => post.status === 'scheduled').length,
      views: posts.reduce((total, post) => total + Number(post.viewCount || 0), 0),
      comments: posts.reduce((total, post) => total + Number(post.commentCount || 0), 0),
      users: userCount,
      isAdmin: admin,
    };

    res.json({
      summary,
      sections: sectionList,
      trend,
      pie: sectionList.map((section) => ({
        key: section.key,
        label: section.label,
        value: section.posts,
      })),
      visitors,
      topPosts,
      categoryStats: Array.from(categoryMap.values())
        .sort((a, b) => b.count - a.count || b.views - a.views)
        .slice(0, 10),
    });
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: '读取后台首页数据失败' });
  }
});

app.get('/api/posts', async (req, res) => {
  try {
    const {
      keyword = '',
      category = '',
      categories = '',
      excludeCategories = '',
      tag = '',
      postType = '',
      type = '',
      status = '',
      sort = '',
      page = 1,
      pageSize = 10,
    } = req.query;
    const user = getOptionalUser(req);
    const query = user
      ? (await isAdminUser(user.userId) ? {} : { author: user.userId })
      : { status: 'published', access: 'public' };

    if (String(keyword).trim()) {
      query.title = {
        $regex: String(keyword).trim(),
        $options: 'i',
      };
    }

    const parseQueryList = (value) => String(value || '')
      .split(',')
      .map((item) => item.trim())
      .filter(Boolean);

    const includeCategoryList = parseQueryList(categories);
    const excludeCategoryList = parseQueryList(excludeCategories);

    if (includeCategoryList.length) {
      query.category = { $in: includeCategoryList };
    } else if (String(category).trim()) {
      query.category = String(category).trim();
    }

    if (excludeCategoryList.length) {
      if (query.category && typeof query.category === 'object') {
        query.category = { ...query.category, $nin: excludeCategoryList };
      } else if (query.category) {
        query.category = { $eq: query.category, $nin: excludeCategoryList };
      } else {
        query.category = { $nin: excludeCategoryList };
      }
    }

    if (String(tag).trim()) {
      query.tags = String(tag).trim();
    }

    const selectedPostType = String(postType || type).trim();

    if (selectedPostType) {
      query.postType = selectedPostType;
    }

    if (user && String(status).trim()) {
      query.status = String(status).trim();
    }

    const currentPage = Math.max(Number(page) || 1, 1);
    const limit = Math.min(Math.max(Number(pageSize) || 10, 1), 50);
    const skip = (currentPage - 1) * limit;
    const sortRule = sort === 'manual'
      ? { sortOrder: 1, publishedAt: 1, createdAt: 1, _id: 1 }
      : sort === 'publishedAsc'
        ? { publishedAt: 1, createdAt: 1, _id: 1 }
        : sort === 'publishedDesc'
          ? { publishedAt: -1, createdAt: -1, _id: -1 }
          : { publishedAt: -1, createdAt: -1, _id: -1 };

    const [posts, total] = await Promise.all([
      Post.find(query)
        .sort(sortRule)
        .skip(skip)
        .limit(limit)
        .populate('author', POST_AUTHOR_FIELDS),
      Post.countDocuments(query),
    ]);

    res.json({
      posts: posts.map(serializePost),
      total,
      page: currentPage,
      pageSize: limit,
    });
  } catch (error) {
    console.error(error);

    res.status(500).json({
      message: '读取文章列表失败',
    });
  }
});

app.post('/api/posts', auth, async (req, res) => {
  try {
    const wray = await getWrayUser();
    const payload = await normalizePostPayload(req.body, wray._id);

    if (!payload.title) {
      return res.status(400).json({
        message: '文章标题不能为空',
      });
    }

    if (!payload.category) {
      return res.status(400).json({
        message: '文章分类不能为空',
      });
    }

    if (payload.status === 'scheduled' && !payload.scheduledAt) {
      return res.status(400).json({
        message: '定时发布时间不能为空',
      });
    }

    if (payload.status === 'scheduled' && payload.scheduledAt.getTime() <= Date.now()) {
      return res.status(400).json({
        message: '定时发布时间必须晚于当前时间',
      });
    }

    const post = await Post.create({
      ...payload,
      author: wray._id,
    });

    await post.populate('author', POST_AUTHOR_FIELDS);

    res.status(201).json({
      message: '文章已创建',
      post: serializePost(post),
    });
  } catch (error) {
    console.error(error);

    res.status(500).json({
      message: '创建文章失败',
    });
  }
});

app.get('/api/posts/sort-order', auth, async (req, res) => {
  try {
    const category = String(req.query.category || '').trim();
    const ownerFilter = await getOwnerFilter(req);

    if (!category) {
      return res.status(400).json({ message: '请选择分类' });
    }

    const posts = await Post.find({
      ...ownerFilter,
      category,
      postType: 'note',
    })
      .sort({ sortOrder: 1, publishedAt: 1, createdAt: 1, _id: 1 })
      .populate('author', POST_AUTHOR_FIELDS);

    res.json({
      posts: posts.map(serializePost),
    });
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: '读取排序列表失败' });
  }
});

app.put('/api/posts/sort-order', auth, async (req, res) => {
  try {
    const category = String(req.body.category || '').trim();
    const ownerFilter = await getOwnerFilter(req);
    const postIds = Array.isArray(req.body.postIds)
      ? req.body.postIds.map((id) => String(id).trim()).filter(Boolean)
      : [];

    if (!category) {
      return res.status(400).json({ message: '请选择分类' });
    }

    if (!postIds.length) {
      return res.status(400).json({ message: '排序列表不能为空' });
    }

    const objectIds = postIds
      .filter((id) => mongoose.Types.ObjectId.isValid(id))
      .map((id) => new mongoose.Types.ObjectId(id));

    if (objectIds.length !== postIds.length) {
      return res.status(400).json({ message: '排序文章参数不正确' });
    }

    const matchedCount = await Post.countDocuments({
      _id: { $in: objectIds },
      ...ownerFilter,
      category,
      postType: 'note',
    });

    if (matchedCount !== postIds.length) {
      return res.status(400).json({ message: '只能排序当前分类下的文章' });
    }

    await Promise.all(postIds.map((postId, index) => Post.updateOne(
      {
        _id: postId,
        ...ownerFilter,
        category,
        postType: 'note',
      },
      {
        $set: { sortOrder: (index + 1) * 1000 },
      }
    )));

    const posts = await Post.find({
      ...ownerFilter,
      category,
      postType: 'note',
    })
      .sort({ sortOrder: 1, publishedAt: 1, createdAt: 1, _id: 1 })
      .populate('author', POST_AUTHOR_FIELDS);

    res.json({
      message: '排序已保存',
      posts: posts.map(serializePost),
    });
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: '保存排序失败' });
  }
});

app.get('/api/posts/:id', auth, async (req, res) => {
  try {
    const ownerFilter = await getOwnerFilter(req);
    const post = await Post.findOne({
      _id: req.params.id,
      ...ownerFilter,
    }).populate('author', POST_AUTHOR_FIELDS);

    if (!post) {
      return res.status(404).json({
        message: '文章不存在',
      });
    }

    res.json({
      post: serializePost(post),
    });
  } catch (error) {
    console.error(error);

    res.status(500).json({
      message: '读取文章详情失败',
    });
  }
});

app.get('/api/public/posts/:id', async (req, res) => {
  try {
    const post = await Post.findOne({
      _id: req.params.id,
      status: 'published',
      access: 'public',
    }).populate('author', POST_AUTHOR_FIELDS);

    if (!post) {
      return res.status(404).json({
        message: '文章不存在或暂无权限查看',
      });
    }

    post.viewCount = Number(post.viewCount || 0) + 1;
    await post.save();

    res.json({
      post: serializePost(post),
    });
  } catch (error) {
    console.error(error);

    res.status(500).json({
      message: '获取文章详情失败',
    });
  }
});

app.put('/api/posts/:id', auth, async (req, res) => {
  try {
    const wray = await getWrayUser();
    const ownerFilter = await getOwnerFilter(req);
    const existingPost = await Post.findOne({
      _id: req.params.id,
      ...ownerFilter,
    }).select('publishedAt sortOrder');

    const payload = await normalizePostPayload(req.body, wray._id, existingPost);

    if (!payload.title) {
      return res.status(400).json({
        message: '文章标题不能为空',
      });
    }

    if (!payload.category) {
      return res.status(400).json({
        message: '文章分类不能为空',
      });
    }

    if (payload.status === 'scheduled' && !payload.scheduledAt) {
      return res.status(400).json({
        message: '定时发布时间不能为空',
      });
    }

    if (payload.status === 'scheduled' && payload.scheduledAt.getTime() <= Date.now()) {
      return res.status(400).json({
        message: '定时发布时间必须晚于当前时间',
      });
    }

    const post = await Post.findOneAndUpdate(
      {
        _id: req.params.id,
        ...ownerFilter,
      },
      {
        ...payload,
        author: wray._id,
      },
      {
        new: true,
      }
    );

    if (!post) {
      return res.status(404).json({
        message: '文章不存在',
      });
    }

    await post.populate('author', POST_AUTHOR_FIELDS);

    res.json({
      message: '文章已更新',
      post: serializePost(post),
    });
  } catch (error) {
    console.error(error);

    res.status(500).json({
      message: '更新文章失败',
    });
  }
});

app.delete('/api/posts/:id', auth, async (req, res) => {
  try {
    const ownerFilter = await getOwnerFilter(req);
    const post = await Post.findOneAndDelete({
      _id: req.params.id,
      ...ownerFilter,
    });

    if (!post) {
      return res.status(404).json({
        message: '文章不存在',
      });
    }

    res.json({
      message: '文章已删除',
    });
  } catch (error) {
    console.error(error);

    res.status(500).json({
      message: '删除文章失败',
    });
  }
});

const publishDueScheduledPosts = async () => {
  try {
    const now = new Date();
    const duePosts = await Post.find({
      status: 'scheduled',
      scheduledAt: { $ne: null, $lte: now },
    }).select('_id scheduledAt');

    if (!duePosts.length) {
      return;
    }

    await Promise.all(
      duePosts.map((post) => Post.updateOne(
        { _id: post._id },
        {
          $set: {
            status: 'published',
            publishedAt: post.scheduledAt || now,
          },
        }
      ))
    );
  } catch (error) {
    console.error(error);
  }
};

const port = process.env.PORT || 3000;

app.post('/api/images', auth, upload.single('file'), async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({
        message: '请选择图片文件',
      });
    }

    if (!req.file.mimetype.startsWith('image/')) {
      return res.status(400).json({
        message: '只支持图片文件',
      });
    }

    const image = await Image.create({
      originalName: req.file.originalname,
      mimeType: req.file.mimetype,
      size: req.file.size,
      data: req.file.buffer,
      uploader: req.user.userId,
    });

    res.status(201).json({
      message: '图片上传成功',
      id: image._id,
      url: `/api/images/${image._id}`,
      originalName: image.originalName,
    });
  } catch (error) {
    console.error(error);

    res.status(500).json({
      message: '图片上传失败',
    });
  }
});

app.get('/api/images/:id', async (req, res) => {
  try {
    const image = await Image.findById(req.params.id);

    if (!image) {
      return res.status(404).json({
        message: '图片不存在',
      });
    }

    res.set('Content-Type', image.mimeType);
    res.set('Content-Length', String(image.size));
    res.set('Cache-Control', 'public, max-age=31536000');

    res.send(image.data);
  } catch (error) {
    console.error(error);

    res.status(500).json({
      message: '读取图片失败',
    });
  }
});

app.post('/api/videos', auth, upload.single('file'), async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({
        message: '请选择视频文件',
      });
    }

    if (!req.file.mimetype.startsWith('video/')) {
      return res.status(400).json({
        message: '只支持视频文件',
      });
    }

    const video = await Video.create({
      originalName: req.file.originalname,
      mimeType: req.file.mimetype,
      size: req.file.size,
      data: req.file.buffer,
      uploader: req.user.userId,
    });

    res.status(201).json({
      message: '视频上传成功',
      id: video._id,
      url: `/api/videos/${video._id}`,
    });
  } catch (error) {
    console.error(error);

    res.status(500).json({
      message: '视频上传失败',
    });
  }
});

app.get('/api/videos/:id', async (req, res) => {
  try {
    const video = await Video.findById(req.params.id);

    if (!video) {
      return res.status(404).json({
        message: '视频不存在',
      });
    }

    res.set('Content-Type', video.mimeType);
    res.set('Content-Length', String(video.size));

    res.send(video.data);
  } catch (error) {
    console.error(error);

    res.status(500).json({
      message: '读取视频失败',
    });
  }
});

app.post('/api/audios', auth, upload.single('file'), async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({
        message: '请选择音频文件',
      });
    }

    if (!req.file.mimetype.startsWith('audio/')) {
      return res.status(400).json({
        message: '只支持音频文件',
      });
    }

    const audio = await Audio.create({
      originalName: req.file.originalname,
      mimeType: req.file.mimetype,
      size: req.file.size,
      data: req.file.buffer,
      uploader: req.user.userId,
    });

    res.status(201).json({
      message: '音频上传成功',
      id: audio._id,
      url: `/api/audios/${audio._id}`,
    });
  } catch (error) {
    console.error(error);

    res.status(500).json({
      message: '音频上传失败',
    });
  }
});

app.get('/api/audios/:id', async (req, res) => {
  try {
    const audio = await Audio.findById(req.params.id);

    if (!audio) {
      return res.status(404).json({
        message: '音频不存在',
      });
    }

    res.set('Content-Type', audio.mimeType);
    res.set('Content-Length', String(audio.size));

    res.send(audio.data);
  } catch (error) {
    console.error(error);

    res.status(500).json({
      message: '读取音频失败',
    });
  }
});


const syncDueScheduledPosts = () => {
  publishDueScheduledPosts();
};

syncDueScheduledPosts();
setInterval(syncDueScheduledPosts, 30 * 1000);

app.listen(port, () => {
  console.log(`Server running at http://localhost:${port}`);
});
