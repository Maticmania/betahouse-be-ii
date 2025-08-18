import * as authService from './auth.service.js';
import passport from "../../config/passport.config.js";

const signup = async (req, res) => {
  try {
    const { token, refreshToken, user } = await authService.signup(req.body, req);
    res.status(200).json({ token, refreshToken, user: { id: user._id, email: user.email, role: user.role, profile: user.profile } });
  } catch (error) {
    res.status(500).json({ message: "Server error", error: error.message });
  }
};

const verifyEmail = async (req, res) => {
  try {
    const { token } = req.query;
    await authService.verifyEmail(token, req.app.get('io'), req.app.get('onlineUsers'));
    res.status(200).json({ message: "Email verified successfully" });
  } catch (error) {
    res.status(500).json({ message: "Server error", error: error.message });
  }
};

const UpdatePhone = async (req, res) => {
    try {
        const { phone } = req.body;
        await authService.UpdatePhone(req.user._id, phone);
        res.status(200).json({ message: "Phone verified", sucess: true });
    } catch (error) {
        res.status(500).json({ message: "Server error", error: error.message });
    }
};

const login = async (req, res) => {
    try {
        const { email, password } = req.body;
        const result = await authService.login(email, password, req);
        res.status(200).json(result);
    } catch (error) {
        res.status(400).json({ message: error.message });
    }
};

const verifyTwoFactorCode = async (req, res) => {
    try {
        const { userId, code } = req.body;
        const result = await authService.verifyTwoFactorCode(userId, code, req);
        res.status(200).json(result);
    } catch (error) {
        res.status(400).json({ message: error.message });
    }
};

const resendTwoFactorCode = async (req, res) => {
    try {
        const { userId } = req.body;
        await authService.resendTwoFactorCode(userId);
        res.status(200).json({ message: "2FA code resent successfully" });
    } catch (error) {
        res.status(500).json({ message: "Server error", error: error.message });
    }
};

const googleAuth = passport.authenticate("google", { scope: ["profile", "email"] });

const googleCallback = async (req, res) => {
    try {
        const { token, refreshToken } = await authService.googleCallback(req.user, req);
        res.redirect(`${process.env.FRONTEND_URL}/auth-success?token=${token}&refresh_token=${refreshToken}`);
    } catch (error) {
        res.redirect(`${process.env.FRONTEND_URL}/auth-error?error=access_denied&error_description=${error.message}`);
    }
};

const facebookAuth = passport.authenticate("facebook", { scope: ["email"] });

const facebookCallback = async (req, res) => {
    try {
        const { token } = await authService.facebookCallback(req.user, req);
        res.redirect(`${process.env.BASE_URL}/auth/success?token=${token}`);
    } catch (error) {
        res.status(500).json({ message: "Server error", error: error.message });
    }
};

const logout = async (req, res) => {
    try {
        const token = req.headers.authorization?.split(" ")[1];
        await authService.logout(token);
        res.status(200).json({ message: "Logged out successfully" });
    } catch (error) {
        res.status(500).json({ message: "Server error", error: error.message });
    }
};

const getSessions = async (req, res) => {
    try {
        const sessions = await authService.getSessions(req.user._id);
        res.status(200).json({ sessions });
    } catch (error) {
        res.status(500).json({ message: "Server error", error: error.message });
    }
};

const revokeSession = async (req, res) => {
    try {
        const { sessionId } = req.params;
        await authService.revokeSession(sessionId, req.user._id);
        res.status(200).json({ message: "Session revoked" });
    } catch (error) {
        res.status(500).json({ message: "Server error", error: error.message });
    }
};

const logoutAllOtherSessions = async (req, res) => {
    try {
        await authService.logoutAllOtherSessions(req.user._id, req.sessionId);
        res.status(200).json({ message: "All other sessions revoked" });
    } catch (error) {
        res.status(500).json({ message: "Server error", error: error.message });
    }
};

const refreshAccessToken = async (req, res) => {
    try {
        const { refreshToken } = req.body;
        const token = await authService.refreshAccessToken(refreshToken);
        res.status(200).json({ token });
    } catch (error) {
        res.status(401).json({ message: error.message });
    }
};

const resendVerificationEmail = async (req, res) => {
    try {
        const { email } = req.body;
        await authService.resendVerificationEmail(email);
        res.status(200).json({ message: "Verification email sent" });
    } catch (error) {
        res.status(500).json({ message: "Server error", error: error.message });
    }
};

const getMe = async (req, res) => {
    try {
        const user = await authService.getMe(req.user._id);
        res.status(200).json({ user });
    } catch (error) {
        res.status(500).json({ message: "Server error", error: error.message });
    }
};

const forgotPassword = async (req, res) => {
    try {
        const { email } = req.body;
        await authService.forgotPassword(email);
        res.status(200).json({ message: "Password reset email sent" });
    } catch (error) {
        res.status(500).json({ message: "Server error", error: error.message });
    }
};

const resetPassword = async (req, res) => {
    try {
        const { token } = req.params;
        const { password } = req.body;
        await authService.resetPassword(token, password);
        res.status(200).json({ message: "Password has been reset" });
    } catch (error) {
        res.status(500).json({ message: "Server error", error: error.message });
    }
};

export { signup, verifyEmail, UpdatePhone, resendVerificationEmail, login, verifyTwoFactorCode, resendTwoFactorCode, googleAuth, googleCallback, facebookAuth, facebookCallback, logout, getSessions, revokeSession, logoutAllOtherSessions, refreshAccessToken, getMe, forgotPassword, resetPassword, };
