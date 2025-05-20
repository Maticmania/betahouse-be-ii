// src/routes/auth.js
import express from 'express';
import passport from '../config/passport.config.js';
import { signup, verifyEmail, login, googleAuth, googleCallback, facebookAuth, facebookCallback, logout, getSessions, revokeSession } from '../controllers/auth/auth.controller.js';
import { authenticate } from '../middlewares/auth.middleware.js';
const router = express.Router();

router.post('/signup', signup);
router.get('/verify-email', verifyEmail);
router.post('/login', login);
router.get('/google', googleAuth);
router.get('/google/callback', passport.authenticate('google', { session: false }), googleCallback);
router.get('/facebook', facebookAuth);
router.get('/facebook/callback', passport.authenticate('facebook', { session: false }), facebookCallback);
router.post('/logout', authenticate, logout);
router.get('/sessions', authenticate, getSessions);
router.delete('/sessions/:sessionId', authenticate, revokeSession);

export default router;