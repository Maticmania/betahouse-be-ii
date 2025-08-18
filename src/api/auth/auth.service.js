import User from "../../models/User.js";
import Session from "../../models/Session.js";
import Notification from "../../models/Notification.js";
import { hashPassword, comparePassword, generateToken, generateRefreshToken, blacklistToken, } from "../../utils/auth.js";
import redisClient from "../../config/redis.config.js";
import { sendVerificationEmail } from "../../services/email.js";
import { v4 as uuidv4 } from "uuid";
import { createNotification } from "../../services/notification.js";
import { UAParser } from "ua-parser-js";
import { getLocationFromIp } from "../../utils/location.js";
import { generateCode } from "../../utils/auth.js";
import { sendTwoFactorCodeEmail, sendPasswordResetEmail } from "../../services/email.js";
import TwoFactorToken from "../../models/TwoFactorToken.js";
import crypto from "crypto";

const createSession = async (user, refreshToken, req) => {
  const parser = new UAParser(req.headers["user-agent"]);
  const device = parser.getResult();
  const ip = req.ip;
  const location = await getLocationFromIp(ip);

  let session = await Session.findOne({
    user: user._id,
    "device.ua": device.ua,
    ipAddress: ip,
  });

  if (session) {
    session.refreshToken = refreshToken;
    session.lastActive = Date.now();
    await session.save();
  } else {
    session = new Session({
      user: user._id,
      refreshToken,
      ipAddress: ip,
      device,
      location,
    });
    await session.save();
  }

  return session;
};

const signup = async (userData, req) => {
  const { email, password, name, phone } = userData;

  const existingUser = await User.findOne({ email });
  if (existingUser) throw new Error("Email already exists");

  const hashedPassword = await hashPassword(password);
  const verificationToken = uuidv4();

  const user = new User({
    email,
    password: hashedPassword,
    phone,
    profile: { name },
    verificationToken,
  });
  await user.save();

  await sendVerificationEmail(user, verificationToken);

  const token = generateToken(user._id);
  const refreshToken = generateRefreshToken(user._id);
  const session = await createSession(user, refreshToken, req);

  const io = req.app.get("io");
  const onlineUsers = req.app.get("onlineUsers");

  await createNotification(
    io,
    onlineUsers,
    user._id,
    "system",
    `Welcome ${user.profile.name || "User"}! We\'re excited to have you onboard.`,
    null,
    "Welcome to BetaHouse 🎉",
    "System"
  );

  await createNotification(
    io,
    onlineUsers,
    user._id,
    "system",
    `Please verify your email to unlock all features on BetaHouse.`,
    null,
    "Verify Your Email ✉️",
    "System"
  );

  return { token, refreshToken, user };
};

const verifyEmail = async (token, io, onlineUsers) => {
  const user = await User.findOne({ verificationToken: token });
  if (!user) throw new Error("Invalid or expired token");

  user.isEmailVerified = true;
  user.verificationToken = null;
  await user.save();

  await Notification.deleteMany({
    user: user._id,
    type: "system",
    title: "Verify Your Email ✉️",
    read: false,
  });

  await createNotification(
    io,
    onlineUsers,
    user._id,
    "system",
    `Your email has been verified. You now have full access to all features.`,
    null,
    "Email Verified ✅",
    "System"
  );
};

const UpdatePhone = async (userId, phone) => {
    const user = await User.findById(userId);
    if (!user) throw new Error("User not found");

    await User.findByIdAndUpdate(
        userId,
        {
            phone: phone,
            isPhoneVerified: true,
        },
        { new: true }
    );
};

const login = async (email, password, req) => {
    const user = await User.findOne({ email });
    if (!user) throw new Error("Invalid credentials");

    const isMatch = await comparePassword(password, user.password);
    if (!isMatch) throw new Error("Invalid credentials");

    if (user.twoFactorEnabled) {
        const code = generateCode();
        const expiresAt = new Date(Date.now() + 5 * 60 * 1000);

        await TwoFactorToken.deleteMany({ user: user._id });

        await TwoFactorToken.create({
            user: user._id,
            code,
            expiresAt,
        });

        await sendTwoFactorCodeEmail(user.email, code);

        return { requires2FA: true, userId: user._id, email: user.email };
    }

    const refreshToken = generateRefreshToken(user._id);
    const session = await createSession(user, refreshToken, req);
    const token = generateToken(user._id, session._id);
    const userObj = user.toObject();

    delete userObj.password;
    return { token, refreshToken, user: userObj };
};

const verifyTwoFactorCode = async (userId, code, req) => {
    const tokenEntry = await TwoFactorToken.findOne({
        user: userId,
        code,
        expiresAt: { $gt: new Date() },
    });

    if (!tokenEntry) throw new Error("Invalid or expired code");

    await TwoFactorToken.deleteMany({ user: userId });

    const user = await User.findById(userId);
    if (!user) throw new Error("User not found");

    const refreshToken = generateRefreshToken(user._id);
    const session = await createSession(user, refreshToken, req);
    const token = generateToken(user._id, session._id);

    return { token, refreshToken, user };
};

const resendTwoFactorCode = async (userId) => {
    const user = await User.findById(userId);
    if (!user) throw new Error("User not found");
    if (!user.twoFactorEnabled) throw new Error("Two-factor authentication is not enabled");

    const code = generateCode();
    const expiresAt = new Date(Date.now() + 5 * 60 * 1000);
    await TwoFactorToken.deleteMany({ user: userId });
    await TwoFactorToken.create({
        user: userId,
        code,
        expiresAt,
    });
    await sendTwoFactorCodeEmail(user.email, code);
};

const googleCallback = async (user, req) => {
    const token = generateToken(user._id);
    const refreshToken = generateRefreshToken(user._id);
    await createSession(user, refreshToken, req);
    return { token, refreshToken };
};

const facebookCallback = async (user, req) => {
    const token = generateToken(user._id);
    const refreshToken = generateRefreshToken(user._id);
    await createSession(user, refreshToken, req);
    return { token };
};

const logout = async (token) => {
    await blacklistToken(token);
    await Session.deleteOne({ token });
};

const getSessions = async (userId) => {
    return await Session.find({ user: userId });
};

const revokeSession = async (sessionId, userId) => {
    const session = await Session.findOne({
        _id: sessionId,
        user: userId,
    });
    if (!session) throw new Error("Session not found");

    await blacklistToken(session.refreshToken);
    await session.deleteOne();
};

const logoutAllOtherSessions = async (userId, currentSessionId) => {
    const otherSessions = await Session.find({
        user: userId,
        _id: { $ne: currentSessionId },
    });

    for (const session of otherSessions) {
        await blacklistToken(session.refreshToken);
    }

    await Session.deleteMany({
        user: userId,
        _id: { $ne: currentSessionId },
    });
};

const refreshAccessToken = async (refreshToken) => {
    const isBlacklisted = await redisClient.get(`blacklist:${refreshToken}`);
    if (isBlacklisted) throw new Error("Refresh token has been revoked");

    const session = await Session.findOne({ refreshToken });
    if (!session) throw new Error("Invalid session");

    const payload = jwt.verify(refreshToken, process.env.JWT_REFRESH_SECRET);

    return generateToken(payload.userId, session._id);
};

const resendVerificationEmail = async (email) => {
    const user = await User.findOne({ email });
    if (!user) throw new Error("User not found");

    if (user.isEmailVerified) throw new Error("Email already verified");

    const newToken = uuidv4();
    user.verificationToken = newToken;
    await user.save();

    await sendVerificationEmail(user, newToken);
};

const getMe = async (userId) => {
    const user = await User.findById(userId).select("-password -verificationToken");
    if (!user) throw new Error("User not found");
    return user;
};

const forgotPassword = async (email) => {
    const user = await User.findOne({ email });
    if (!user) return;

    const resetToken = crypto.randomBytes(20).toString("hex");
    user.resetPasswordToken = resetToken;
    user.resetPasswordExpires = Date.now() + 3600000;
    await user.save();

    await sendPasswordResetEmail(user, resetToken);
};

const resetPassword = async (token, password) => {
    const user = await User.findOne({
        resetPasswordToken: token,
        resetPasswordExpires: { $gt: Date.now() },
    });
    if (!user) throw new Error("Invalid or expired token");

    user.password = await hashPassword(password);
    user.resetPasswordToken = undefined;
    user.resetPasswordExpires = undefined;
    await user.save();

    const sessions = await Session.find({ user: user._id });
    for (const session of sessions) {
        await blacklistToken(session.refreshToken);
    }
    await Session.deleteMany({ user: user._id });
};

export { signup, verifyEmail, UpdatePhone, login, verifyTwoFactorCode, resendTwoFactorCode, googleCallback, facebookCallback, logout, getSessions, revokeSession, logoutAllOtherSessions, refreshAccessToken, resendVerificationEmail, getMe, forgotPassword, resetPassword, createSession };

export const send2FACode = async (userId) => {
    const user = await User.findById(userId);
    if (!user) throw new Error("User not found");

    const code = generateCode();
    const expiresAt = new Date(Date.now() + 5 * 60 * 1000);

    await TwoFactorToken.deleteMany({ user: userId });

    await TwoFactorToken.create({
        user: userId,
        code,
        expiresAt,
    });

    await sendTwoFactorCodeEmail(user.email, code);
};

export const verify2FACode = async (userId, code) => {
    const token = await TwoFactorToken.findOne({ user: userId, code });
    if (!token) throw new Error("Invalid or expired code");

    if (token.expiresAt < new Date()) throw new Error("Code has expired");

    const user = await User.findById(userId);
    if (!user) throw new Error("User not found");

    user.twoFactorEnabled = true;
    token.verified = true;

    await token.save();
    await user.save();
};

export const setupTwoFactor = async (userId) => {
    const user = await User.findById(userId);
    if (!user) throw new Error("User not found");

    const code = generateCode();
    const expiresAt = new Date(Date.now() + 5 * 60 * 1000);

    await TwoFactorToken.deleteMany({ user: userId });

    await TwoFactorToken.create({
        user: userId,
        code,
        expiresAt,
    });

    await sendTwoFactorCodeEmail(user.email, code);
};

export const disableTwoFactor = async (userId) => {
    const user = await User.findById(userId);
    if (!user) throw new Error("User not found");

    user.twoFactorEnabled = false;
    await user.save();

    await TwoFactorToken.deleteMany({ user: userId });
};

export const getTwoFactorStatus = async (userId) => {
    const user = await User.findById(userId).select("twoFactorEnabled");
    if (!user) throw new Error("User not found");

    return user.twoFactorEnabled;
};
