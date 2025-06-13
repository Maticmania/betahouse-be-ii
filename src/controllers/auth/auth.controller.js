// src/api/auth/auth.controller.js
import User from "../../models/User.js";
import Session from "../../models/Session.js";
import Notification from "../../models/Notification.js";
import {
  hashPassword,
  comparePassword,
  generateToken,
  generateRefreshToken,
  blacklistToken,
} from "../../utils/auth.js";
import { sendVerificationEmail } from "../../services/email.js";
import { v4 as uuidv4 } from "uuid";
import passport from "../../config/passport.config.js";
import { createNotification } from "../../services/notification.js";
import jwt from "jsonwebtoken";

const signup = async (req, res) => {
  const { email, password, name, phone } = req.body;

  try {
    const existingUser = await User.findOne({ email });
    if (existingUser)
      return res.status(400).json({ message: "Email already exists" });

    const hashedPassword = await hashPassword(password);
    const verificationToken = uuidv4();

    const user = new User({
      email,
      password: hashedPassword,
      profile: { name, phone },
      verificationToken,
    });
    await user.save();

    // 1. Send verification email
    await sendVerificationEmail(user, verificationToken);

    // 2. Create session
    const token = generateToken(user._id);
    const refreshToken = generateRefreshToken(user._id);
    const session = new Session({
      user: user._id,
      token: refreshToken,
      device: req.headers["user-agent"],
      ipAddress: req.ip,
    });
    await session.save();

    // 3. Create welcome notification
    await createNotification(
      user._id,
      'system',
      `Welcome ${user.profile.name || 'User'}! We're excited to have you onboard.`,
      null,
      'Welcome to BetaHouse 🎉',
      'System'
    );

    // 4. Create verify email reminder
    await createNotification(
      user._id,
      'system',
      `Please verify your email to unlock all features on BetaHouse.`,
      null,
      'Verify Your Email ✉️',
      'System'
    );

    res.status(200).json({
      token,
      refreshToken,
      user: {
        id: user._id,
        email: user.email,
        role: user.role,
        profile: user.profile,
      },
    });
  } catch (error) {
    console.error("Signup error:", error);
    res.status(500).json({ message: "Server error", error: error.message });
  }
};


const verifyEmail = async (req, res) => {
  const { token } = req.query;
  try {
    const user = await User.findOne({ verificationToken: token });
    if (!user)
      return res.status(400).json({ message: "Invalid or expired token" });

    user.isEmailVerified = true;
    user.verificationToken = null;
    await user.save();

    // Delete the "verify email" notification
    await Notification.deleteMany({
      user: user._id,
      type: 'system',
      title: 'Verify Your Email ✉️',
      read: false,
    });

    // Create a "welcome" notification
    await createNotification(
      user._id,
      'system',
      `Your email has been verified. You now have full access to all features.`,
      null,
      'Email Verified ✅',
      'System'
    );

    res.status(200).json({ message: "Email verified successfully" });
  } catch (error) {
    console.error("Email verification error:", error);
    res.status(500).json({ message: "Server error", error: error.message });
  }
};

// verify phone number(update this later, cos you need firebse to verify the number )
const verifyPhone = async (req, res) => {
  const { phone } = req.body;
  try {
    const user = await User.findOneAndUpdate(
      { phone },
      { phoneVerified: true },
      { new: true }
    );

    if (!user) return res.status(404).json({ message: "User not found" });

    res.status(200).json({ message: "Phone verified", user });
  } catch (error) {
    res.status(500).json({ message: "Server error", error: error.message });
  }
};

const login = async (req, res) => {
  const { email, password } = req.body;
  try {
    const user = await User.findOne({ email });
    if (!user) return res.status(400).json({ message: "Invalid credentials" });

    const isMatch = await comparePassword(password, user.password);
    if (!isMatch)
      return res.status(400).json({ message: "Invalid credentials" });

    const token = generateToken(user._id);
    const refreshToken = generateRefreshToken(user._id);

    const session = new Session({
      user: user._id,
      token: refreshToken,
      device: req.headers["user-agent"],
      ipAddress: req.ip,
    });
    await session.save();

    res
      .status(200)
      .json({
        token,
        refreshToken,
        user: {
          id: user._id,
          email: user.email,
          isEmailVerified: user.isEmailVerified,
          role: user.role,
          profile: user.profile,
        },
      });
  } catch (error) {
    console.error("Login error:", error);
    res.status(500).json({ message: "Server error", error: error.message });
  }
};

const googleAuth = passport.authenticate("google", {
  scope: ["profile", "email"],
});

const googleCallback = async (req, res) => {
  try {
    const token = generateToken(req.user._id);
    const refreshToken = generateRefreshToken(req.user._id);

    const session = new Session({
      user: req.user._id,
      token: refreshToken,
      device: req.headers["user-agent"],
      ipAddress: req.ip,
    });
    await session.save();

    res.redirect(`${process.env.FRONTEND_URL}/auth-success?token=${token}&refresh_token=${refreshToken}`);
  } catch (error) {
    res.redirect(`${process.env.FRONTEND_URL}/auth-error?error=${access_denied}&error_description={error.message}`);
    res.status(500).json({ message: "Server error", error: error.message });
  }
};

const facebookAuth = passport.authenticate("facebook", { scope: ["email"] });

const facebookCallback = async (req, res) => {
  try {
    const token = generateToken(req.user._id);
    const session = new Session({
      user: req.user._id,
      token,
      device: req.headers["user-agent"],
      ipAddress: req.ip,
    });
    await session.save();

    res.redirect(`${process.env.BASE_URL}/auth/success?token=${token}`);
  } catch (error) {
    res.status(500).json({ message: "Server error", error: error.message });
  }
};

const logout = async (req, res) => {
  const token = req.headers.authorization?.split(" ")[1];
  try {
    await blacklistToken(token);
    await Session.deleteOne({ token });
    res.status(200).json({ message: "Logged out successfully" });
  } catch (error) {
    res.status(500).json({ message: "Server error", error: error.message });
  }
};

const getSessions = async (req, res) => {
  try {
    const sessions = await Session.find({ user: req.user._id });
    res.status(200).json(sessions);
  } catch (error) {
    res.status(500).json({ message: "Server error", error: error.message });
  }
};

const revokeSession = async (req, res) => {
  const { sessionId } = req.params;
  try {
    const session = await Session.findOne({
      _id: sessionId,
      user: req.user._id,
    });
    if (!session) return res.status(404).json({ message: "Session not found" });

    await blacklistToken(session.token);
    await session.deleteOne();
    res.status(200).json({ message: "Session revoked" });
  } catch (error) {
    res.status(500).json({ message: "Server error", error: error.message });
  }
};

const refreshAccessToken = async (req, res) => {
  const { refreshToken } = req.body;

  if (!refreshToken) return res.status(401).json({ message: "No refresh token provided" });

  try {
    const session = await Session.findOne({ token: refreshToken });
    if (!session) return res.status(403).json({ message: "Invalid session" });

    const payload = jwt.verify(refreshToken, process.env.JWT_REFRESH_SECRET);

    const newAccessToken = generateToken(payload.userId);
    res.status(200).json({ token: newAccessToken });

  } catch (err) {
    console.log("Refresh token error:", err);
    res.status(401).json({ message: "Refresh token expired or invalid", error: err.message });
  }
};

const resendVerificationEmail = async (req, res) => {
  const { email } = req.body;

  try {
    const user = await User.findOne({ email });
    if (!user) return res.status(404).json({ message: "User not found" });

    if (user.isEmailVerified) {
      return res.status(400).json({ message: "Email already verified" });
    }

    const newToken = uuidv4();
    user.verificationToken = newToken;
    await user.save();

    await sendVerificationEmail(user, newToken);

    res.status(200).json({ message: "Verification email sent" });
  } catch (error) {
    console.error(error) 
    res.status(500).json({ message: "Server error", error: error.message });
  }
};

const getMe = async (req, res) => {
  try {
    const user = await User.findById(req.user._id).select('-password -verificationToken');
    if (!user) return res.status(404).json({ message: 'User not found' });

    res.status(200).json({ user });
  } catch (error) {
    res.status(500).json({ message: 'Server error', error: error.message });
  }
};

export {
  signup,
  verifyEmail,
  resendVerificationEmail,
  login,
  googleAuth,
  googleCallback,
  facebookAuth,
  facebookCallback,
  logout,
  getSessions,
  revokeSession,
  refreshAccessToken,
  getMe
};
