import mongoose from 'mongoose';
import bcrypt from 'bcryptjs';
import dotenv from 'dotenv';
import User from '../models/User.js';

dotenv.config();

await mongoose.connect(process.env.MONGO_URI);

const username = 'admin';
const password = '123456';

const passwordHash = await bcrypt.hash(password, 10);

await User.findOneAndUpdate(
  { username },
  {
    username,
    nickname: '管理员',
    passwordHash,
    role: 'admin',
  },
  {
    upsert: true,
    new: true,
  }
);

console.log('管理员账号创建成功');
console.log(`账号: ${username}`);
console.log(`密码: ${password}`);

await mongoose.disconnect();
