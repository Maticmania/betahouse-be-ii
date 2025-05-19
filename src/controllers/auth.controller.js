import bcrypt from 'bcrypt';
import jwt from 'jsonwebtoken';
import User from '../models/User.js';
import redis from '../config/redis.js';

const createToken = (user) => {
  return jwt.sign({ id: user._id, role: user.role }, process.env.JWT_SECRET, {
    expiresIn: process.env.JWT_EXPIRES_IN,
  });
};

export const register = async (req, res) => {
  const { name, email, password } = req.body;
  try {
    const existing = await User.findOne({ email });
    if (existing) return res.status(400).json({ message: 'Email already exists' });

    const hashed = await bcrypt.hash(password, 10);
    const user = await User.create({ name, email, password: hashed });
    res.status(201).json({ message: 'User registered', user });
  } catch (err) {
    res.status(500).json({ message: 'Register error', error: err.message });
  }
};

export const login = async (req, res) => {
  const { email, password } = req.body;
  try {
    const user = await User.findOne({ email });
    if (!user) return res.status(404).json({ message: 'User not found' });

    const match = await bcrypt.compare(password, user.password);
    if (!match) return res.status(401).json({ message: 'Incorrect password' });

    const token = createToken(user);
    res.json({ message: 'Login successful', token, user });
  } catch (err) {
    res.status(500).json({ message: 'Login error', error: err.message });
  }
};

export const logout = async (req, res) => {
  const token = req.token;
  if (!token) return res.status(400).json({ message: 'Token missing' });

  await redis.set(`blacklist_${token}`, true, 'EX', 86400); // 1 day
  res.json({ message: 'User logged out' });
};

export const me = async (req, res) => {
  res.json({ user: req.user });
};
