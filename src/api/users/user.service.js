import User from "../../models/User.js";
import { hashPassword, comparePassword } from "../../utils/auth.js";
import redisClient from "../../config/redis.config.js";
import { createNotification } from "../../services/notification.js";
import { sendVerificationEmail } from "../../services/email.js";
import { v4 as uuidv4 } from "uuid";

const listUsers = async (page = 1, limit = 10, role = null) => {
  const query = role ? { role } : {};

  const users = await User.find(query)
    .select("-password -verificationToken")
    .sort({ createdAt: -1 })
    .skip((page - 1) * limit)
    .limit(Number(limit))
    .lean();

  const total = await User.countDocuments(query);

  return {
    users,
    total,
    page: Number(page),
    pages: Math.ceil(total / limit),
  };
};

const deleteUser = async (userId, currentUserId) => {
  const user = await User.findById(userId);
  if (!user) {
    throw new Error("User not found");
  }

  if (user._id.toString() === currentUserId.toString()) {
    throw new Error("Cannot delete yourself");
  }

  await user.deleteOne();
  await redisClient.del(`user:${userId}`);

  return { message: "User deleted" };
};

const addAgentReview = async (
  agentId,
  userId,
  username,
  rating,
  comment,
  io,
  onlineUsers
) => {
  if (rating < 1 || rating > 5) {
    throw new Error("Rating must be between 1 and 5");
  }

  const agent = await User.findById(agentId);
  if (!agent || agent.role !== "agent") {
    throw new Error("Agent not found");
  }

  // Prevent self-review
  if (agent._id.toString() === userId.toString()) {
    throw new Error("Cannot review yourself");
  }

  // Add review
  agent.ratings.reviews.push({
    user: userId,
    rating,
    comment,
  });

  // Update average rating
  const totalRatings = agent.ratings.reviews.length;
  const averageRating =
    agent.ratings.reviews.reduce((sum, review) => sum + review.rating, 0) /
    totalRatings;
  agent.ratings.average = Math.round(averageRating * 10) / 10;
  agent.ratings.count = totalRatings;

  await agent.save();

  // Notify agent
  await createNotification(
    io,
    onlineUsers,
    agent._id,
    "agent_review",
    `You received a ${rating}-star review from @${username}: "${comment}"`,
    agent._id,
    "New Agent Review",
    "User"
  );

  // Clear cache
  await redisClient.del(`user:${agent._id}`);

  return agent;
};

const getAgentProfile = async (agentId) => {
  const agent = await User.findById(agentId)
    .select("username profile ratings role")
    .lean();

  if (!agent || agent.role !== "agent") {
    throw new Error("Agent not found");
  }

  // Cache agent profile for 1 hour
  await redisClient.setEx(`user:${agent._id}`, 3600, JSON.stringify(agent));

  return agent;
};

const getAllAgents = async () => {
  const agents = await User.find({ role: "agent" })
    .select("username profile ratings role")
    .lean();

  if (!agents.length) {
    throw new Error("No agents found");
  }

  // Cache agent profiles for 1 hour
  await redisClient.setEx(`agents`, 3600, JSON.stringify(agents));

  return agents;
};

const updateProfile = async (userId, profileData) => {
  const user = await User.findById(userId);
  if (!user) {
    throw new Error("User not found");
  }
  const { name, phone, bio, state, gender, photo } = profileData;

  user.profile.name = name || user.profile.name;
  user.profile.about.bio = bio || user.profile.about.bio;
  user.profile.state = state || user.profile.state;
  user.profile.gender = gender || user.profile.gender;
  if (photo) {
    user.profile.photo = {
      url: photo.url ?? user.profile.photo.url,
      publicId: photo.publicId ?? user.profile.photo.publicId,
    };
  }

  if (phone) {
    user.phone = phone || user.phone;
    user.isPhoneVerified = false; // Reset phone verification status
  }

  await user.save();
  await redisClient.del(`user:${user._id}`);

  return user;
};

const updateUserProfile = async (
  userId,
  profileData,
  adminRole,
  io,
  onlineUsers
) => {
  const user = await User.findById(userId);
  if (!user) {
    throw new Error("User not found");
  }

  if (adminRole !== "admin") {
    throw new Error("Not authorized to update this user");
  }

  const { username, email, profile, role } = profileData;

  // Prevent non-admins from changing role
  if (role && adminRole !== "admin") {
    throw new Error("Only admins can change roles");
  }

  // Update fields
  user.username = username || user.username;
  user.email = email || user.email;
  user.profile = profile ? { ...user.profile, ...profile } : user.profile;
  if (role) {
    user.role = role;
  }

  await user.save();

  // Notify user of updates
  await createNotification(
    io,
    onlineUsers,
    user._id,
    "profile_updated",
    `Your profile (@${user.username}) has been updated by an admin.`,
    user._id,
    "Profile Update",
    "User"
  );

  // Clear cache
  await redisClient.del(`user:${user._id}`);

  return user;
};

const deleteUserSelf = async (userId, password) => {
  const user = await User.findById(userId);
  if (!user) {
    throw new Error("User not found");
  }

  // Verify password
  const isMatch = await comparePassword(password, user.password);
  if (!isMatch) {
    throw new Error("Incorrect password");
  }

  await user.deleteOne();
  await redisClient.del(`user:${user._id}`);

  return { message: "User account deleted successfully" };
};

const updateEmail = async (userId, newEmail) => {
  const user = await User.findById(userId);
  if (!user) {
    throw new Error("User not found");
  }

  // Check if email is already taken
  const existingUser = await User.findOne({ email: newEmail });
  if (existingUser && existingUser._id.toString() !== userId.toString()) {
    throw new Error("Email is already taken");
  }

  user.email = newEmail;
  user.isEmailVerified = false;

  const verificationToken = uuidv4();
  await sendVerificationEmail(user, verificationToken);

  await user.save();
  await redisClient.del(`user:${user._id}`);

  return { message: "Email updated successfully" };
};

const updatePassword = async (
  userId,
  currentPassword,
  newPassword,
  io,
  onlineUsers
) => {
  const user = await User.findById(userId);
  if (!user) {
    throw new Error("User not found");
  }

  // Verify current password
  const isMatch = await comparePassword(currentPassword, user.password);
  if (!isMatch) {
    throw new Error("Incorrect current password");
  }

  // Update password
  const hashedPassword = await hashPassword(newPassword);
  user.password = hashedPassword;

  await user.save();

  // Notify user
  await createNotification(
    io,
    onlineUsers,
    user._id,
    "system",
    `Hello ${user.profile.name}, your password has been successfully updated. If you did not request this change, please contact support immediately.`,
    null,
    "Password Update",
    "System"
  );

  await redisClient.del(`user:${user._id}`);

  return { message: "Password updated successfully" };
};

export {
  listUsers,
  deleteUser,
  addAgentReview,
  getAgentProfile,
  getAllAgents,
  updateProfile,
  updateUserProfile,
  deleteUserSelf,
  updateEmail,
  updatePassword,
};
