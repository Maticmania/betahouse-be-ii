import express from 'express';
import passport from '../config/passport.config.js';
import { signup, verifyEmail, login, googleAuth, googleCallback, facebookAuth, facebookCallback, logout, getSessions, revokeSession,refreshAccessToken,resendVerificationEmail,getMe } from '../controllers/auth/auth.controller.js';
import { authenticate } from '../middlewares/auth.middleware.js';
import { send2FACode, verify2FACode, setupTwoFactor,disableTwoFactor,getTwoFactorStatus } from '../controllers/auth/twoFactor.controller.js';
const router = express.Router();

router.post('/signup', signup);
router.get('/verify-email', verifyEmail);
router.post('/login', login);
router.post('/refresh-token', refreshAccessToken);
router.get('/me', authenticate, getMe);
router.get('/google', googleAuth);
router.get('/google/callback', passport.authenticate('google', { session: false }), googleCallback);
router.get('/facebook', facebookAuth);
router.get('/facebook/callback', passport.authenticate('facebook', { session: false }), facebookCallback);
router.post('/logout', authenticate, logout);
router.get('/sessions', authenticate, getSessions);
router.delete('/sessions/:sessionId', authenticate, revokeSession);
router.post('/resend-verification', resendVerificationEmail);

router.get('/2fa/status', authenticate, getTwoFactorStatus);
router.post('/2fa/send-code', authenticate, send2FACode );
router.post('/2fa/verify-code', authenticate, verify2FACode );
router.post('/2fa/setup', authenticate, setupTwoFactor );
router.post('/2fa/disable', authenticate, disableTwoFactor);
 
export default router;