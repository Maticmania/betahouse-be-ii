import * as authService from './auth.service.js';

export const send2FACode = async (req, res) => {
    try {
        await authService.send2FACode(req.user._id);
        res.json({ message: `2FA code sent to your email` });
    } catch (error) {
        res.status(500).json({ message: "Internal server error" });
    }
};

export const verify2FACode = async (req, res) => {
    try {
        const { code } = req.body;
        await authService.verify2FACode(req.user._id, code);
        res.json({ message: "2FA code verified successfully" });
    } catch (error) {
        res.status(500).json({ message: "Internal server error" });
    }
};

export const setupTwoFactor = async (req, res) => {
    try {
        await authService.setupTwoFactor(req.user._id);
        res.json({ success: true, message: `2FA code sent to your email` });
    } catch (error) {
        res.status(500).json({ message: "Internal server error" });
    }
};

export const disableTwoFactor = async (req, res) => {
    try {
        await authService.disableTwoFactor(req.user._id);
        res.json({ message: "Two-factor authentication disabled successfully" });
    } catch (error) {
        res.status(500).json({ message: "Internal server error" });
    }
};

export const getTwoFactorStatus = async (req, res) => {
    try {
        const twoFactorEnabled = await authService.getTwoFactorStatus(req.user._id);
        res.json({ twoFactorEnabled });
    } catch (error) {
        res.status(500).json({ message: "Internal server error" });
    }
};
