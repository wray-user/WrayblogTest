import express from 'express';
import cors from 'cors';
import mongoose from 'mongoose';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import dotenv from 'dotenv';
import User from './models/User.js';
import auth from './middleware/auth.js';

dotenv.config();

const app = express();

app.use(cors({
  origin: 'http://localhost:5173',
}));

app.use(express.json());

await mongoose.connect(process.env.MONGO_URI);
console.log('MongoDB connected');

app.get('/api/health', (req, res) => {
  res.json({ ok: true });
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

  const token = jwt.sign(
    {
      userId: user._id,
      username: user.username,
      role: user.role,
    },
    process.env.JWT_SECRET,
    {
      expiresIn: '7d',
    }
  );

  res.json({
    message: '登录成功',
    token,
  });
});

app.get('/api/admin/me', auth, (req, res) => {
  res.json({
    message: '已进入后台',
    user: req.user,
  });
});

const port = process.env.PORT || 3000;

app.listen(port, () => {
  console.log(`Server running at http://localhost:${port}`);
});
