
import User from '../../models/User.js';
import Property from '../../models/Property.js';
import AgentReview from '../../models/AgentReview.js';
import { cloudinary }s from '../../config/cloudinary.config.js';
import { hashPassword } from '../../utils/auth.js';

const listUsers = async (page, limit) => {
    const users = await User.find()
        .select('-password')
        .skip((page - 1) * limit)
        .limit(limit);
    const total = await User.countDocuments();
    return { users, total, page, pages: Math.ceil(total / limit) };
};

const deleteUser = async (userId) => {
    const user = await User.findById(userId);
    if (!user) {
        throw new Error('User not found');
    }
    await user.deleteOne();
};

const addAgentReview = async (agentId, userId, rating, comment) => {
    const agent = await User.findById(agentId);
    if (!agent || agent.role !== 'agent') {
        throw new Error('Agent not found');
    }

    const review = new AgentReview({
        agent: agentId,
        user: userId,
        rating,
        comment,
    });

    await review.save();

    const reviews = await AgentReview.find({ agent: agentId });
    const totalRating = reviews.reduce((acc, r) => acc + r.rating, 0);
    agent.agentProfile.rating = totalRating / reviews.length;
    agent.agentProfile.reviewCount = reviews.length;
    await agent.save();

    return review;
};

const getAgentProfile = async (agentId) => {
    const agent = await User.findById(agentId).select('-password');
    if (!agent || agent.role !== 'agent') {
        throw new Error('Agent not found');
    }
    const properties = await Property.find({ createdBy: agentId });
    const reviews = await AgentReview.find({ agent: agentId }).populate('user', 'profile.name');
    return { agent, properties, reviews };
};

const getAllAgents = async (page, limit) => {
    const agents = await User.find({ role: 'agent' })
        .select('-password')
        .skip((page - 1) * limit)
        .limit(limit);
    const total = await User.countDocuments({ role: 'agent' });
    return { agents, total, page, pages: Math.ceil(total / limit) };
};

const updateProfile = async (userId, profileData, file) => {
    const user = await User.findById(userId);
    if (!user) {
        throw new Error('User not found');
    }

    if (file) {
        const result = await cloudinary.uploader.upload(file.path, {
            folder: 'real-estate/avatars',
        });
        user.profile.photo = result.secure_url;
    }

    user.profile.name = profileData.name || user.profile.name;
    user.profile.bio = profileData.bio || user.profile.bio;
    user.profile.phone = profileData.phone || user.profile.phone;
    user.profile.address = profileData.address || user.profile.address;

    await user.save();
    return user;
};

const updateUserProfile = async (userId, profileData, file) => {
    const user = await User.findById(userId);
    if (!user) {
        throw new Error('User not found');
    }

    if (file) {
        const result = await cloudinary.uploader.upload(file.path, {
            folder: 'real-estate/avatars',
        });
        user.profile.photo = result.secure_url;
    }

    user.profile.name = profileData.name || user.profile.name;
    user.profile.bio = profileData.bio || user.profile.bio;
    user.profile.phone = profileData.phone || user.profile.phone;
    user.profile.address = profileData.address || user.profile.address;
    user.role = profileData.role || user.role;

    await user.save();
    return user;
};

const deleteUserSelf = async (userId) => {
    const user = await User.findById(userId);
    if (!user) {
        throw new Error('User not found');
    }
    await user.deleteOne();
};

const updateEmail = async (userId, newEmail) => {
    const user = await User.findById(userId);
    if (!user) {
        throw new Error('User not found');
    }
    user.email = newEmail;
    user.isEmailVerified = false;
    await user.save();
    // You might want to send a verification email here
};

const updatePassword = async (userId, newPassword) => {
    const user = await User.findById(userId);
    if (!user) {
        throw new Error('User not found');
    }
    user.password = await hashPassword(newPassword);
    await user.save();
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
