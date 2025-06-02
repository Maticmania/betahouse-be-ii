// src/routes/notification.js
import express from "express";
import {
  deleteNotification,
  getUserNotifications,
  markAllNotifications,
  markAsRead,
} from "../controllers/notification/notification.controller.js";
import { authenticate } from "../middlewares/auth.middleware.js";

const router = express.Router();

router.get("/", authenticate, getUserNotifications);
router.put("/:notificationId/read", authenticate, markAsRead);
router.put("/all", authenticate, markAllNotifications);
router.delete("/:notificationId", authenticate, deleteNotification);

export default router;
