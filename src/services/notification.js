import Notification from '../models/Notification.js';
import redisClient from '../config/redis.config.js';
import { sendNotificationEmail } from './email.js';
import User from '../models/User.js';

const createNotification = async (userId, type, content, relatedId = null) => {
  try {
    const notification = new Notification({
      user: userId,
      type,
      content,
      relatedId,
    });
    await notification.save();

    // Cache notifications for 24 hours
    await redisClient.set(
    `notifications:${userId}:${notification._id}`,
    JSON.stringify(notification),
    'EX',
    24 * 60 * 60 // 24 hours in seconds
    );

    // Send email notification
    const user = await User.findById(userId);
    await sendNotificationEmail(user.email, type.replace('_', ' ').toUpperCase(), content);
  } catch (error) {
    console.error('Notification creation error:', error);
  }
};

const getNotifications = async (userId, page = 1, limit = 10) => {
  try {
    // Check Redis cache first
    const cachedNotifications = await redisClient.keys(`notifications:${userId}:*`);
    let notifications = [];

    if (cachedNotifications.length > 0) {
      notifications = await Promise.all(
        cachedNotifications.map(async (key) => JSON.parse(await redisClient.get(key)))
      );
    }

    // If cache is incomplete, fetch from MongoDB
    if (notifications.length < limit) {
      notifications = await Notification.find({ user: userId })
        .sort({ createdAt: -1 })
        .skip((page - 1) * limit)
        .limit(Number(limit))
        .lean();

      // Update cache
      for (const notification of notifications) {
        await redisClient.setEx(
          `notifications:${userId}:${notification._id}`,
          24 * 60 * 60,
          JSON.stringify(notification)
        );
      }
    }

    const total = await Notification.countDocuments({ user: userId });
    return {
      notifications,
      total,
      page: Number(page),
      pages: Math.ceil(total / limit),
    };
  } catch (error) {
    throw new Error(`Failed to fetch notifications: ${error.message}`);
  }
};

const markNotificationRead = async (userId, notificationId) => {
  try {
    const notification = await Notification.findOne({ _id: notificationId, user: userId });
    if (!notification) throw new Error('Notification not found');

    notification.read = true;
    await notification.save();

    // Update cache
    await redisClient.setEx(
      `notifications:${userId}:${notification._id}`,
      24 * 60 * 60,
      JSON.stringify(notification)
    );
  } catch (error) {
    throw new Error(`Failed to mark notification read: ${error.message}`);
  }
};

export { createNotification, getNotifications, markNotificationRead };