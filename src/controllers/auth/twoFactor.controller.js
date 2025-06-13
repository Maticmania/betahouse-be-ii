// controllers/twoFactor.controller.js
import User from "../../models/User.js";
import { generateCode } from "../../utils/auth.js";
import { sendTwoFactorCodeEmail } from "../../services/email.js";
import TwoFactorToken from "../../models/TwoFactorToken.js";

export const send2FACode = async (req, res) => {
  const { userId } = req.body;
  try {
    const user = await User.findById(userId);
    if (!user) return res.status(404).json({ message: "User not found" });

    const code = generateCode();
    const expiresAt = new Date(Date.now() + 5 * 60 * 1000); // 5 mins

    await TwoFactorToken.deleteMany({ user: userId }); // clear old

    await TwoFactorToken.create({
      user: userId,
      code,
      method,
      expiresAt,
    });

    await sendTwoFactorCodeEmail(user.email, code);

    res.json({ message: `2FA code sent to your email` });
  } catch (error) {
    console.error("Error sending 2FA code:", error);
    return res.status(500).json({ message: "Internal server error" });
  }
};

export const verify2FACode = async (req, res) => {
  const { userId, code } = req.body;
  try {
    const token = await TwoFactorToken.findOne({ user: userId, code });
    if (!token) return res.status(400).json({ message: "Invalid or expired code" });

    if (token.expiresAt < new Date()) {
      return res.status(400).json({ message: "Code has expired" });
    }

    token.verified = true;
    await token.save();

    res.json({ message: "2FA code verified successfully" });
  } catch (error) {
    console.error("Error verifying 2FA code:", error);
    return res.status(500).json({ message: "Internal server error" });
  }
};

// two factor setup
export const setupTwoFactor = async (req, res) => {
  const { userId } = req.body;
  try {
    const user = await User.findById(userId);
    if (!user) return res.status(404).json({ message: "User not found" });

    user.twoFactorEnabled = true;
    await user.save();

    res.json({ message: `Two-factor authentication ${enable ? 'enabled' : 'disabled'} successfully` });
  } catch (error) {
    console.error("Error setting up 2FA:", error);
    return res.status(500).json({ message: "Internal server error" });
  }
};
// disbale two factor
export const disableTwoFactor = async (req, res) => {
  const { userId } = req.body;
  try {
    const user = await User.findById(userId);
    if (!user) return res.status(404).json({ message: "User not found" });

    user.twoFactorEnabled = false;
    await user.save();

    // Clear any existing 2FA tokens
    await TwoFactorToken.deleteMany({ user: userId });

    res.json({ message: "Two-factor authentication disabled successfully" });
  } catch (error) {
    console.error("Error disabling 2FA:", error);
    return res.status(500).json({ message: "Internal server error" });
  }
};

//two factor status
export const getTwoFactorStatus = async (req, res) => {
  const { userId } = req.body;
  try {
    const user = await User.findById(userId).select('twoFactorEnabled');
    if (!user) return res.status(404).json({ message: "User not found" });

    res.json({ twoFactorEnabled: user.twoFactorEnabled });
  } catch (error) {
    console.error("Error fetching 2FA status:", error);
    return res.status(500).json({ message: "Internal server error" });
  }
};