// src/routes/notification.js
import express from 'express';
import { getUserNotifications, markAsRead } from '../controllers/notification/notification.controller.js';
import { authenticate } from '../middlewares/auth.middleware.js';

const router = express.Router();

router.get('/', authenticate, getUserNotifications);
router.put('/:notificationId/read', authenticate, markAsRead);

export default router;