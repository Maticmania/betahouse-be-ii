// src/utils/auth.js
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import redisClient from '../config/redis.config.js';
import crypto from "crypto";


const hashPassword = async (password) => {
  const salt = await bcrypt.genSalt(10);
  return bcrypt.hash(password, salt);
};

const comparePassword = async (password, hashedPassword) => {
  return bcrypt.compare(password, hashedPassword);
};

const generateToken = (userId) => {
  return jwt.sign({ userId }, process.env.JWT_SECRET, { expiresIn: '1m' });
};
export const generateRefreshToken = (userId) => {
  return jwt.sign({ userId }, process.env.JWT_REFRESH_SECRET, { expiresIn: "7d" });
};
const blacklistToken = async (token) => {
  const decoded = jwt.decode(token);
  const expiresIn = decoded.exp - Math.floor(Date.now() / 1000);
  await redisClient.set(`blacklist:${token}`, 'blacklisted', 'EX', expiresIn);
};

const verifyToken = async (token) => {
  const isBlacklisted = await redisClient.get(`blacklist:${token}`);
  if (isBlacklisted) throw new Error('Token is blacklisted');
try {
    // Try access token first
    return jwt.verify(token, process.env.JWT_SECRET);
  } catch (err) {
    // // If it fails, try refresh token
    // try {
    //   return jwt.verify(token, process.env.JWT_REFRESH_SECRET);
    // } catch (refreshErr) {
    //   throw new Error("Invalid or expired token");
    // }
  }
};

const generateCode = (length = 6) => {
  let code = '';
  const bytes = crypto.randomBytes(length); // generates secure random bytes

  for (let i = 0; i < length; i++) {
    // Convert each byte to a digit (0–9)
    code += bytes[i] % 10;
  }

  return code;
};


export { hashPassword, comparePassword, generateToken, blacklistToken, verifyToken, generateCode };