import express from 'express';
import { login, logout, me, register } from '../controllers/auth.controller.js';
import { protect } from '../middlewares/auth.js';

const router = express.Router();

router.post('/register', register);
router.post('/login', login);
router.post('/logout', protect, logout);
router.get('/me', protect, me);

export default router;
