import jwt from 'jsonwebtoken';

const auth = (req, res, next) => {
  const header = req.headers.authorization;

  if (!header || !header.startsWith('Bearer ')) {
    return res.status(401).json({ message: '未登录' });
  }

  const token = header.replace('Bearer ', '');

  try {
    const payload = jwt.verify(token, process.env.JWT_SECRET || 'wray-blog-secret');
    req.user = payload;
    next();
  } catch {
    return res.status(401).json({ message: '登录已过期' });
  }
};

export default auth;
