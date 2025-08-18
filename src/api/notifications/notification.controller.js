import * as notificationService from './notification.service.js';

const getUserNotifications = async (req, res) => {
    try {
        const { page, limit } = req.query;
        const result = await notificationService.getNotifications(req.user._id, page, limit);
        res.status(200).json(result);
    } catch (error) {
        res.status(500).json({ message: "Server error", error: error.message });
    }
};

const notifyNewMessage = async (req, res) => {
    try {
        const { recipientId, senderId, propertyId, messageText } = req.body;
        const notification = await notificationService.notifyNewMessage(req.app.get('io'), req.app.get('onlineUsers'), recipientId, senderId, propertyId, messageText);
        return res.status(201).json({ success: true, notification });
    } catch (err) {
        return res.status(500).json({ error: "Failed to send message notification" });
    }
};

const markAsRead = async (req, res) => {
    try {
        const { notificationId } = req.params;
        await notificationService.markNotificationRead(req.user._id, notificationId);
        res.status(200).json({ message: "Notification marked as read" });
    } catch (error) {
        res.status(500).json({ message: "Server error", error: error.message });
    }
};

const markAllNotifications = async (req, res) => {
    try {
        await notificationService.markAllNotificationsRead(req.user._id);
        res.status(200).json({ message: "All notifications marked as read" });
    } catch (error) {
        res.status(500).json({ message: "Server error", error: error.message });
    }
};

const deleteNotification = async (req, res) => {
    try {
        const { notificationId } = req.params;
        await notificationService.deleteNotificationservice(req.user._id, notificationId);
        res.status(200).json({ message: "Notification deleted sucessfully" });
    } catch (error) {
        res.status(500).json({ message: "Server error", error: error.message });
    }
};

const sendTestNotification = async (req, res) => {
    try {
        const { userId, message } = req.body;
        const result = await notificationService.sendTestNotification(req.app.get('io'), req.app.get('onlineUsers'), userId, message);
        return res.json({ success: true, ...result });
    } catch (error) {
        return res.status(500).json({ error: "Failed to send test notification" });
    }
};

export { getUserNotifications, markAsRead, markAllNotifications, deleteNotification, notifyNewMessage, sendTestNotification };
