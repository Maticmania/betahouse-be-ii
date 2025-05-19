import jwt from 'jsonwebtoken';
import redis from '../config/redis.js';
import User from '../models/User.js';

export const protect = async (req, res, next) => {
  const auth = req.headers.authorization;
  if (!auth || !auth.startsWith('Bearer '))
    return res.status(401).json({ message: 'Unauthorized' });

  const token = auth.split(' ')[1];
  req.token = token;

  const isBlacklisted = await redis.get(`blacklist_${token}`);
  if (isBlacklisted) return res.status(401).json({ message: 'Token blacklisted' });

  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    const user = await User.findById(decoded.id).select('-password');
    if (!user) return res.status(404).json({ message: 'User not found' });

    req.user = user;
    next();
  } catch (err) {
    res.status(401).json({ message: 'Invalid token' });
  }
};

export const authorize = (...roles) => {
  return (req, res, next) => {
    if (!roles.includes(req.user.role)) {
      return res.status(403).json({ message: 'Forbidden: Insufficient role' });
    }
    next();
  };
};
