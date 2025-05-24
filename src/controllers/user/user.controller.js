// src/api/user/user.controller.js
import User from '../../models/User.js';
import { createNotification } from '../../services/notification.js';
import cloudinary from '../../config/cloudinary.config.js';
import redisClient from '../../config/redis.config.js';

// List users (Admin only)
const listUsers = async (req, res) => {
  try {
    const { page = 1, limit = 10, role } = req.query;
    const query = role ? { role } : {};

    const users = await User.find(query)
      .select('-password -verificationToken')
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
    res.status(500).json({ message: 'Server error', error: error.message });
  }
};

// Update user (Admin or self)
const updateUser = async (req, res) => {
  try {
    const { id } = req.params;
    const { username, email, profile, role } = req.body;

    const user = await User.findById(id);
    if (!user) {
      return res.status(404).json({ message: 'User not found' });
    }

    if (req.user.role !== 'admin' && req.user._id.toString() !== id) {
      return res.status(403).json({ message: 'Not authorized to update this user' });
    }

    // Prevent non-admins from changing role
    if (role && req.user.role !== 'admin') {
      return res.status(403).json({ message: 'Only admins can change roles' });
    }

    // Update fields
    user.username = username || user.username;
    user.email = email || user.email;
    user.profile = profile ? { ...user.profile, ...profile } : user.profile;
    if (req.user.role === 'admin') {
      user.role = role || user.role;
    }

    // Handle profile photo upload
    if (req.file) {
      const result = await cloudinary.uploader.upload(req.file.path, {
        folder: 'real-estate/users',
      });
      user.profile.photo = result.secure_url;
    }

    await user.save();

    // Notify user of updates
    await createNotification(
      user._id,
      'profile_updated',
      `Your profile (@${user.username}) has been updated.`,
      user._id
    );

    // Clear cache
    await redisClient.del(`user:${user._id}`);

    res.status(200).json({ message: 'User updated', user: user.toObject({ getters: true }) });
  } catch (error) {
    res.status(500).json({ message: 'Server error', error: error.message });
  }
};

// Delete user (Admin only)
const deleteUser = async (req, res) => {
  try {
    const { id } = req.params;
    const user = await User.findById(id);
    if (!user) {
      return res.status(404).json({ message: 'User not found' });
    }

    if (user._id.toString() === req.user._id.toString()) {
      return res.status(403).json({ message: 'Cannot delete yourself' });
    }

    // Delete associated KYC
    await AgentKYC.deleteOne({ user: id });

    // Delete user
    await user.deleteOne();

    // Clear cache
    await redisClient.del(`user:${id}`);

    res.status(200).json({ message: 'User deleted' });
  } catch (error) {
    res.status(500).json({ message: 'Server error', error: error.message });
  }
};

// Add agent review (User only)
const addAgentReview = async (req, res) => {
  try {
    const { agentId } = req.params;
    const { rating, comment } = req.body;

    if (rating < 1 || rating > 5) {
      return res.status(400).json({ message: 'Rating must be between 1 and 5' });
    }

    const agent = await User.findById(agentId);
    if (!agent || agent.role !== 'agent') {
      return res.status(404).json({ message: 'Agent not found' });
    }

    // Prevent self-review
    if (agent._id.toString() === req.user._id.toString()) {
      return res.status(403).json({ message: 'Cannot review yourself' });
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
      agent.ratings.reviews.reduce((sum, review) => sum + review.rating, 0) / totalRatings;
    agent.ratings.average = Math.round(averageRating * 10) / 10;
    agent.ratings.count = totalRatings;

    await agent.save();

    // Notify agent
    await createNotification(
      agent._id,
      'agent_review',
      `You received a ${rating}-star review from @${req.user.username}: "${comment}"`,
      agent._id
    );

    // Clear cache
    await redisClient.del(`user:${agent._id}`);

    res.status(200).json({ message: 'Review added', agent });
  } catch (error) {
    res.status(500).json({ message: 'Server error', error: error.message });
  }
};

// Get agent profile (Public)
const getAgentProfile = async (req, res) => {
  try {
    const { agentId } = req.params;
    const agent = await User.findById(agentId)
      .select('username profile ratings role')
      .lean();

    if (!agent || agent.role !== 'agent') {
      return res.status(404).json({ message: 'Agent not found' });
    }

    // Cache agent profile for 1 hour
    await redisClient.setEx(`user:${agent._id}`, 3600, JSON.stringify(agent));

    res.status(200).json(agent);
  } catch (error) {
    res.status(500).json({ message: 'Server error', error: error.message });
  }
};

//get all agents (Public)
const getAllAgents = async (req, res) => {
  try {
    const agents = await User.find({ role: 'agent' })
      .select('username profile ratings role')
      .lean();

    if (!agents.length) {
      return res.status(404).json({ message: 'No agents found' });
    }

    // Cache agent profiles for 1 hour
    await redisClient.setEx(`agents`, 3600, JSON.stringify(agents));

    res.status(200).json(agents);
  } catch (error) {
    res.status(500).json({ message: 'Server error', error: error.message });
  }
};

export { listUsers, updateUser, deleteUser, addAgentReview, getAgentProfile, getAllAgents };