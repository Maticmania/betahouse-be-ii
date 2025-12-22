import * as authService from "./auth.service.js";
import passport from "../../config/passport.config.js";

// Helper to set secure cookies
const setAuthCookies = (res, token, refreshToken) => {
  const cookieOptions = {
    httpOnly: true, // Prevents JS access
    secure: process.env.NODE_ENV === "production", // HTTPS only in prod
    sameSite: "Lax", // CSRF protection
    maxAge: 7 * 24 * 60 * 60 * 1000, // 7 days
  };

  res.cookie("token", token, cookieOptions);
  if (refreshToken) {
    res.cookie("refreshToken", refreshToken, cookieOptions);
  }
};

const signup = async (req, res) => {
  try {
    const { token, refreshToken, user } = await authService.signup(
      req.body,
      req
    );
    setAuthCookies(res, token, refreshToken);
    res.status(200).json({
      user: {
        id: user._id,
        email: user.email,
        role: user.role,
        profile: user.profile,
      },
    });
  } catch (error) {
    res.status(500).json({ message: "Server error", error: error.message });
  }
};

const verifyEmail = async (req, res) => {
  try {
    const { token } = req.query;
    await authService.verifyEmail(
      token,
      req.app.get("io"),
      req.app.get("onlineUsers")
    );
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

    if (result.requires2FA) {
      return res.status(200).json(result);
    }

    // Set cookies
    setAuthCookies(res, result.token, result.refreshToken);

    res.status(200).json({
      user: result.user,
      message: "Login successful",
    });
  } catch (error) {
    res.status(400).json({ message: error.message });
  }
};

// 1. Verify 2FA and Log In
const verifyTwoFactorCode = async (req, res) => {
  try {
    const { userId, code } = req.body;
    const result = await authService.verifyTwoFactorCode(userId, code, req);

    // After 2FA is verified, we set the cookies to log the user in
    setAuthCookies(res, result.token, result.refreshToken);

    res.status(200).json({
      user: result.user,
      message: "2FA Verified. Welcome back!",
    });
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

const googleAuth = passport.authenticate("google", {
  scope: ["profile", "email"],
});

const googleCallback = async (req, res) => {
  try {
    const { token, refreshToken } = await authService.googleCallback(
      req.user,
      req
    );

    // Set cookies for social login
    setAuthCookies(res, token, refreshToken);

    res.redirect(`${process.env.FRONTEND_URL}/auth-success`);
  } catch (error) {
    res.redirect(
      `${process.env.FRONTEND_URL}/auth-error?error=access_denied&error_description=${error.message}`
    );
  }
};

const facebookAuth = passport.authenticate("facebook", { scope: ["email"] });

const facebookCallback = async (req, res) => {
  try {
    const { token } = await authService.facebookCallback(req.user, req);

    setAuthCookies(res, token, refreshToken);

    res.redirect(`${process.env.BASE_URL}/auth-success`);
  } catch (error) {
    res.status(500).json({ message: "Server error", error: error.message });
  }
};

const logout = async (req, res) => {
  try {
    // 1. Get token from cookie instead of header
    const token = req.cookies.token;
    if (token) await authService.logout(token);

    // 2. Clear the cookies in the browser
    res.clearCookie("token");
    res.clearCookie("refreshToken");

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
    // Get refresh token from cookie
    const { refreshToken } = req.cookies;
    if (!refreshToken) throw new Error("No refresh token");

    const newToken = await authService.refreshAccessToken(refreshToken);

    // Set the new access token cookie
    res.cookie("token", newToken, {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "Lax",
      maxAge: 7 * 24 * 60 * 60 * 1000,
    });

    res.status(200).json({ message: "Token refreshed" });
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

export {
  signup,
  verifyEmail,
  UpdatePhone,
  resendVerificationEmail,
  login,
  verifyTwoFactorCode,
  resendTwoFactorCode,
  googleAuth,
  googleCallback,
  facebookAuth,
  facebookCallback,
  logout,
  getSessions,
  revokeSession,
  logoutAllOtherSessions,
  refreshAccessToken,
  getMe,
  forgotPassword,
  resetPassword,
};
