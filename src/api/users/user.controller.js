// src/api/user/user.controller.js
import User from "../../models/User.js";
import { createNotification } from "../../services/notification.js";
import redisClient from "../../config/redis.config.js";
// import AgentKYC from "../../models/AgentKYC.js";
import { cloudinary } from "../../config/cloudinary.config.js";
import { comparePassword } from "../../utils/auth.js";
import { sendVerificationEmail } from "../../services/email.js";
import { hashPassword } from "../../utils/auth.js";
import { v4 as uuidv4 } from "uuid";
import fs from "fs";
// List users (Admin only)
const listUsers = async (req, res) => {
  try {
    const { page = 1, limit = 10, role } = req.query;
    const query = role ? { role } : {};

    const users = await User.find(query)
      .select("-password -verificationToken")
      .sort({ createdAt: -1 })
      .skip((page - 1) * limit)
      .limit(Number(limit))
      .lean();

    const total = await User.countDocuments(query);

    res.status(200).json({
      users,
      total,
      page: Number(page),
      pages: Math.ceil(total / limit),
    });
  } catch (error) {
    res.status(500).json({ message: "Server error", error: error.message });
  }
};

// Update profile (self)
const updateProfile = async (req, res) => {
  try {
    const id = req.user._id;
    const { name, phone, bio, state, gender, removeImage } = req.body;

    const user = await User.findById(id);
    if (!user) return res.status(404).json({ message: "User not found" });

    user.profile.name = name || user.profile.name;
    // user.phone = phone || user.phone;
    user.profile.about.bio = bio || user.profile.about.bio;
    user.profile.state = state || user.profile.state;
    user.profile.gender = gender || user.profile.gender;

    if (phone) {
      user.phone = phone || user.phone;
      user.isPhoneVerified = false; // Reset phone verification status
    }

    if (req.file) {
      const result = await cloudinary.uploader.upload(req.file.path, {
        folder: "Betahouse/profile",
      });
      user.profile.photo = result.secure_url;

      // Optional: clean up uploaded file
      fs.unlinkSync(req.file.path);
    } else if (removeImage === "true" || removeImage === true) {
      item.image = null;
    }

    await user.save();
    await redisClient.del(`user:${user._id}`);
    res.status(200).json({
      message: "Profile updated",
      user: user.toObject({ getters: true }),
    });
  } catch (error) {
    console.error("Error updating profile:", error);
    res.status(500).json({ message: "Server error", error: error.message });
  }
};

//update email
const updateEmail = async (req, res) => {
  try {
    const userId = req.user._id;
    const { email } = req.body;
    const user = await User.findById(userId);
    if (!user) {
      return res.status(404).json({ message: "User not found" });
    }
    // Check if email is already taken
    const existingUser = await User.findOne({ email });
    if (existingUser && existingUser._id.toString() !== userId.toString()) {
      return res.status(400).json({ message: "Email is already taken" });
    }
    user.email = email;
    user.isEmailVerified = false;
    const verificationToken = uuidv4();

    await sendVerificationEmail(user, verificationToken);
    // Save user
    await user.save();
    // Clear cache
    await redisClient.del(`user:${user._id}`);

    res.status(200).json({ message: "Email updated successfully" });
  } catch (error) {
    console.error("Error updating email:", error);
    res.status(500).json({ message: "Server error", error: error.message });
  }
};

//Update password
const updatePassword = async (req, res) => {
  try {
    const userId = req.user._id; // ✅ fix destructure
    const { currentPassword, newPassword } = req.body;
    const user = await User.findById(userId);
    if (!user) {
      return res.status(404).json({ message: "User not found" });
    }
    // ✅ Verify current password
    const isMatch = await comparePassword(currentPassword, user.password);
    if (!isMatch) {
      return res.status(400).json({ message: "Incorrect current password" });
    }
    // ✅ Update password
    const hashedPassword = await hashPassword(newPassword);
    user.password = hashedPassword; // Assuming you have a hashPassword function to hash the new password

    await user.save();
    // ✅ Clear cache

    const io = req.app.get("io");
    const onlineUsers = req.app.get("onlineUsers");
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
    res.status(200).json({ message: "Password updated successfully" });
  } catch (error) {
    console.error("Error updating password:", error);
    res.status(500).json({ message: "Server error", error: error.message });
  }
};

// Update user profile (Admin only)
const updateUserProfile = async (req, res) => {
  try {
    const { id } = req.params;
    const { username, email, profile, role } = req.body;

    const user = await User.findById(id);
    if (!user) {
      return res.status(404).json({ message: "User not found" });
    }
    if (req.user.role !== "admin") {
      return res
        .status(403)
        .json({ message: "Not authorized to update this user" });
    }
    // Prevent non-admins from changing role
    if (role && req.user.role !== "admin") {
      return res.status(403).json({ message: "Only admins can change roles" });
    }
    // Update fields
    user.username = username || user.username;
    user.email = email || user.email;
    user.profile = profile ? { ...user.profile, ...profile } : user.profile;
    if (role) {
      user.role = role;
    }
    // Handle profile photo upload
    if (req.file) {
      const result = await cloudinary.uploader.upload(req.file.path, {
        folder: "real-estate/users",
      });
      user.profile.photo = result.secure_url;
    }
    await user.save();
    const io = req.app.get("io");
    const onlineUsers = req.app.get("onlineUsers");
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
    res.status(200).json({
      message: "User profile updated",
      user: user.toObject({ getters: true }),
    });
  } catch (error) {
    res.status(500).json({ message: "Server error", error: error.message });
  }
};

//delete user (self) verify password before deleting
const deleteUserSelf = async (req, res) => {
  try {
    const userId = req.user._id; // ✅ fix destructure
    const { password } = req.body;

    const user = await User.findById(userId);
    if (!user) {
      return res.status(404).json({ message: "User not found" });
    }

    // ✅ Verify password
    const isMatch = await comparePassword(password, user.password);
    if (!isMatch) {
      return res.status(400).json({ message: "Incorrect password" });
    }

    // ✅ Delete user
    await user.deleteOne();

    // ✅ Clear cache
    await redisClient.del(`user:${user._id}`);

    res.status(200).json({ message: "User account deleted successfully" });
  } catch (error) {
    console.error("Error deleting user:", error);
    res.status(500).json({ message: "Server error", error: error.message });
  }
};

// Delete user (Admin only)
const deleteUser = async (req, res) => {
  try {
    const { id } = req.params;
    const user = await User.findById(id);
    if (!user) {
      return res.status(404).json({ message: "User not found" });
    }

    if (user._id.toString() === req.user._id.toString()) {
      return res.status(403).json({ message: "Cannot delete yourself" });
    }

    // Delete associated KYC
    // await AgentKYC.deleteOne({ user: id });

    // Delete user
    await user.deleteOne();

    // Clear cache
    await redisClient.del(`user:${id}`);

    res.status(200).json({ message: "User deleted" });
  } catch (error) {
    res.status(500).json({ message: "Server error", error: error.message });
  }
};

// Add agent review (User only)
const addAgentReview = async (req, res) => {
  try {
    const { agentId } = req.params;
    const { rating, comment } = req.body;

    if (rating < 1 || rating > 5) {
      return res
        .status(400)
        .json({ message: "Rating must be between 1 and 5" });
    }

    const agent = await User.findById(agentId);
    if (!agent || agent.role !== "agent") {
      return res.status(404).json({ message: "Agent not found" });
    }

    // Prevent self-review
    if (agent._id.toString() === req.user._id.toString()) {
      return res.status(403).json({ message: "Cannot review yourself" });
    }

    // Add review
    agent.ratings.reviews.push({
      user: req.user._id,
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

    const io = req.app.get("io");
    const onlineUsers = req.app.get("onlineUsers");
    // Notify agent
    await createNotification(
      io,
      onlineUsers,
      agent._id,
      "agent_review",
      `You received a ${rating}-star review from @${req.user.username}: "${comment}"`,
      agent._id,
      "New Agent Review",
      "User"
    );

    // Clear cache
    await redisClient.del(`user:${agent._id}`);

    res.status(200).json({ message: "Review added", agent });
  } catch (error) {
    res.status(500).json({ message: "Server error", error: error.message });
  }
};

// Get agent profile (Public)
const getAgentProfile = async (req, res) => {
  try {
    const { agentId } = req.params;
    const agent = await User.findById(agentId)
      .select("username profile ratings role")
      .lean();

    if (!agent || agent.role !== "agent") {
      return res.status(404).json({ message: "Agent not found" });
    }

    // Cache agent profile for 1 hour
    await redisClient.setEx(`user:${agent._id}`, 3600, JSON.stringify(agent));

    res.status(200).json(agent);
  } catch (error) {
    res.status(500).json({ message: "Server error", error: error.message });
  }
};

//get all agents (Public)
const getAllAgents = async (req, res) => {
  try {
    const agents = await User.find({ role: "agent" })
      .select("username profile ratings role")
      .lean();

    if (!agents.length) {
      return res.status(404).json({ message: "No agents found" });
    }

    // Cache agent profiles for 1 hour
    await redisClient.setEx(`agents`, 3600, JSON.stringify(agents));

    res.status(200).json(agents);
  } catch (error) {
    res.status(500).json({ message: "Server error", error: error.message });
  }
};

export {
  listUsers,
  updateProfile,
  updateUserProfile,
  deleteUser,
  addAgentReview,
  getAgentProfile,
  getAllAgents,
  deleteUserSelf,
  updateEmail,
  updatePassword,
};
