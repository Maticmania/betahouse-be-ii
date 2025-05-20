// src/api/auth/auth.controller.js
import User from '../../models/User.js';
import Session from '../../models/Session.js';
import { hashPassword, comparePassword, generateToken, blacklistToken } from '../../utils/auth.js';
import { sendVerificationEmail } from '../../service/email.js';
import { v4 as uuidv4 } from 'uuid';
import passport from '../../config/passport.config.js';

const signup = async (req, res) => {
  const { email, password, name, phone } = req.body;
  try {
    const existingUser = await User.findOne({ email });
    if (existingUser) return res.status(400).json({ message: 'Email already exists' });

    const hashedPassword = await hashPassword(password);
    const verificationToken = uuidv4();

    const user = new User({
      email,
      password: hashedPassword,
      profile: { name, phone },
      verificationToken,
    });
    await user.save();

    await sendVerificationEmail(user, verificationToken);

    res.status(201).json({ message: 'User created. Please verify your email.' });
  } catch (error) {
    res.status(500).json({ message: 'Server error', error: error.message });
  }
};

const verifyEmail = async (req, res) => {
  const { token } = req.query;
  try {
    const user = await User.findOne({ verificationToken: token });
    if (!user) return res.status(400).json({ message: 'Invalid or expired token' });

    user.isEmailVerified = true;
    user.verificationToken = null;
    await user.save();

    res.status(200).json({ message: 'Email verified successfully' });
  } catch (error) {
    res.status(500).json({ message: 'Server error', error: error.message });
  }
};

const login = async (req, res) => {
  const { email, password } = req.body;
  try {
    const user = await User.findOne({ email });
    if (!user) return res.status(400).json({ message: 'Invalid credentials' });

    const isMatch = await comparePassword(password, user.password);
    if (!isMatch) return res.status(400).json({ message: 'Invalid credentials' });

    if (!user.isEmailVerified) return res.status(403).json({ message: 'Please verify your email' });

    const token = generateToken(user._id);
    const session = new Session({
      user: user._id,
      token,
      device: req.headers['user-agent'],
      ipAddress: req.ip,
    });
    await session.save();

    res.status(200).json({ token, user: { id: user._id, email: user.email, role: user.role } });
  } catch (error) {
    res.status(500).json({ message: 'Server error', error: error.message });
  }
};

const googleAuth = passport.authenticate('google', { scope: ['profile', 'email'] });

const googleCallback = async (req, res) => {
  try {
    const token = generateToken(req.user._id);
    const session = new Session({
      user: req.user._id,
      token,
      device: req.headers['user-agent'],
      ipAddress: req.ip,
    });
    await session.save();

    res.redirect(`${process.env.BASE_URL}/auth/success?token=${token}`);
  } catch (error) {
    res.status(500).json({ message: 'Server error', error: error.message });
  }
};

const facebookAuth = passport.authenticate('facebook', { scope: ['email'] });

const facebookCallback = async (req, res) => {
  try {
    const token = generateToken(req.user._id);
    const session = new Session({
      user: req.user._id,
      token,
      device: req.headers['user-agent'],
      ipAddress: req.ip,
    });
    await session.save();

    res.redirect(`${process.env.BASE_URL}/auth/success?token=${token}`);
  } catch (error) {
    res.status(500).json({ message: 'Server error', error: error.message });
  }
};

const logout = async (req, res) => {
  const token = req.headers.authorization?.split(' ')[1];
  try {
    await blacklistToken(token);
    await Session.deleteOne({ token });
    res.status(200).json({ message: 'Logged out successfully' });
  } catch (error) {
    res.status(500).json({ message: 'Server error', error: error.message });
  }
};

const getSessions = async (req, res) => {
  try {
    const sessions = await Session.find({ user: req.user._id });
    res.status(200).json(sessions);
  } catch (error) {
    res.status(500).json({ message: 'Server error', error: error.message });
  }
};

const revokeSession = async (req, res) => {
  const { sessionId } = req.params;
  try {
    const session = await Session.findOne({ _id: sessionId, user: req.user._id });
    if (!session) return res.status(404).json({ message: 'Session not found' });

    await blacklistToken(session.token);
    await session.deleteOne();
    res.status(200).json({ message: 'Session revoked' });
  } catch (error) {
    res.status(500).json({ message: 'Server error', error: error.message });
  }
};

export { signup, verifyEmail, login, googleAuth, googleCallback, facebookAuth, facebookCallback, logout, getSessions, revokeSession };