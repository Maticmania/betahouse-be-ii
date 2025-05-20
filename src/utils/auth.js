// src/utils/auth.js
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import redisClient from '../config/redis.config.js';

const hashPassword = async (password) => {
  const salt = await bcrypt.genSalt(10);
  return bcrypt.hash(password, salt);
};

const comparePassword = async (password, hashedPassword) => {
  return bcrypt.compare(password, hashedPassword);
};

const generateToken = (userId) => {
  return jwt.sign({ userId }, process.env.JWT_SECRET, { expiresIn: '7d' });
};

const blacklistToken = async (token) => {
  const decoded = jwt.decode(token);
  const expiresIn = decoded.exp - Math.floor(Date.now() / 1000);
  await redisClient.set(`blacklist:${token}`, 'blacklisted', 'EX', expiresIn);
};

const verifyToken = async (token) => {
  const isBlacklisted = await redisClient.get(`blacklist:${token}`);
  if (isBlacklisted) throw new Error('Token is blacklisted');
  return jwt.verify(token, process.env.JWT_SECRET);
};

export { hashPassword, comparePassword, generateToken, blacklistToken, verifyToken };