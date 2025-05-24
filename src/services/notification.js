import Notification from '../models/Notification.js';
import redisClient from '../config/redis.config.js';
import { sendNotificationEmail } from './email.js';
import User from '../models/User.js';

/**
 * Scans Redis keys with a match pattern
 */
const scanKeys = async (pattern) => {
  let cursor = '0';
  const keys = [];

  do {
    const [nextCursor, batchKeys] = await redisClient.scan(cursor, 'MATCH', pattern, 'COUNT', 100);
    cursor = nextCursor;
    keys.push(...batchKeys);
  } while (cursor !== '0');

  return keys;
};

/**
 * Creates a notification and caches it
 */
export const createNotification = async (userId, type, content, relatedId = null) => {
  try {
    const notification = await new Notification({
      user: userId,
      type,
      content,
      relatedId,
    }).save();

    // Cache notification
    await redisClient.set(
      `notifications:${userId}:${notification._id}`,
      JSON.stringify(notification),
      'EX',
      24 * 60 * 60
    );

    // Email user
    const user = await User.findById(userId).lean();
    if (user?.email) {
      await sendNotificationEmail(
        user.email,
        type.replace(/_/g, ' ').toUpperCase(),
        content
      );
    }

    return notification;
  } catch (error) {
    console.error('Notification creation error:', error);
    throw new Error('Failed to create notification');
  }
};

/**
 * Gets notifications from cache or MongoDB
 */
export const getNotifications = async (userId, page = 1, limit = 10) => {
  try {
    const keys = await scanKeys(`notifications:${userId}:*`);
    let notifications = [];

    if (keys.length) {
      const raw = await Promise.all(keys.map((k) => redisClient.get(k)));
      notifications = raw
        .filter(Boolean)
        .map((n) => JSON.parse(n))
        .sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
    }

    const total = await Notification.countDocuments({ user: userId });

    // Fallback if Redis incomplete
    if (notifications.length < limit) {
      const skip = (page - 1) * limit;
      const dbNotifications = await Notification.find({ user: userId })
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(Number(limit))
        .lean();

      notifications = dbNotifications;

      // Async cache update (non-blocking)
      Promise.all(
        dbNotifications.map((n) =>
          redisClient.set(
            `notifications:${userId}:${n._id}`,
            JSON.stringify(n),
            'EX',
            24 * 60 * 60
          )
        )
      );
    }

    // Paginate cached or DB results
    const paginated = notifications.slice((page - 1) * limit, page * limit);

    return {
      notifications: paginated,
      total,
      page: Number(page),
      pages: Math.ceil(total / limit),
    };
  } catch (err) {
    throw new Error(`Failed to fetch notifications: ${err.message}`);
  }
};

/**
 * Marks one notification as read
 */
export const markNotificationRead = async (userId, notificationId) => {
  try {
    const notification = await Notification.findOne({ _id: notificationId, user: userId });
    if (!notification) throw new Error('Notification not found');

    notification.read = true;
    await notification.save();

    await redisClient.set(
      `notifications:${userId}:${notification._id}`,
      JSON.stringify(notification),
      'EX',
      24 * 60 * 60
    );

    return notification;
  } catch (err) {
    throw new Error(`Failed to mark notification read: ${err.message}`);
  }
};

/**
 * Marks all notifications as read for a user
 */
export const markAllNotificationsRead = async (userId) => {
  try {
    const result = await Notification.updateMany(
      { user: userId, read: false },
      { $set: { read: true } }
    );

    // Async update in Redis
    const keys = await scanKeys(`notifications:${userId}:*`);
    await Promise.all(
      keys.map(async (key) => {
        const raw = await redisClient.get(key);
        if (raw) {
          const data = JSON.parse(raw);
          if (!data.read) {
            data.read = true;
            await redisClient.set(key, JSON.stringify(data), 'EX', 24 * 60 * 60);
          }
        }
      })
    );

    return { updated: result.modifiedCount };
  } catch (err) {
    throw new Error(`Failed to mark all notifications read: ${err.message}`);
  }
};
