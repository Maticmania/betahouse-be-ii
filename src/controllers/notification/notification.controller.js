// src/api/notification/notification.controller.js
import { getNotifications, markNotificationRead } from '../../services/notification.js';

const getUserNotifications = async (req, res) => {
  try {
    const { page, limit } = req.query;
    const { notifications, total, page: currentPage, pages } = await getNotifications(
      req.user._id,
      page,
      limit
    );
    res.status(200).json({ notifications, total, page: currentPage, pages });
  } catch (error) {
    res.status(500).json({ message: 'Server error', error: error.message });
  }
};

const markAsRead = async (req, res) => {
  try {
    const { notificationId } = req.params;
    await markNotificationRead(req.user._id, notificationId);
    res.status(200).json({ message: 'Notification marked as read' });
  } catch (error) {
    res.status(500).json({ message: 'Server error', error: error.message });
  }
};

export { getUserNotifications, markAsRead };