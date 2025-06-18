// src/api/notification/notification.controller.js
import {
  deleteNotificationservice,
  getNotifications,
  markAllNotificationsRead,
  markNotificationRead,
} from "../../services/notification.js";

const getUserNotifications = async (req, res) => {
  try {
    const { page, limit } = req.query;
    const {
      notifications,
      total,
      page: currentPage,
      pages,
    } = await getNotifications(req.user._id, page, limit);
    res.status(200).json({ notifications, total, page: currentPage, pages });
  } catch (error) {
    res.status(500).json({ message: "Server error", error: error.message });
  }
};

const markAsRead = async (req, res) => {
  try {
    const { notificationId } = req.params;
    await markNotificationRead(req.user._id, notificationId);
    res.status(200).json({ message: "Notification marked as read" });
  } catch (error) {
    res.status(500).json({ message: "Server error", error: error.message });
  }
};

const markAllNotifications = async (req, res) => {
  try {
    await markAllNotificationsRead(req.user._id);
    res.status(200).json({ message: "All notifications marked as read" });
  } catch (error) {
    res.status(500).json({ message: "Server error", error: error.message });
  }
};

const deleteNotification = async (req, res) => {
  try {
    const { notificationId } = req.params;
    await deleteNotificationservice(req.user._id, notificationId);
    res.status(200).json({ message: "Notification deleted sucessfully" });
  } catch (error) {
    console.log("Error deleting notification:", error);
    res.status(500).json({ message: "Server error", error: error.message });
  }
};

export {
  getUserNotifications,
  markAsRead,
  markAllNotifications,
  deleteNotification,
};
