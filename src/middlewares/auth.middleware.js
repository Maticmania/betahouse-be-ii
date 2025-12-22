import { verifyToken } from "../utils/auth.js";
import User from "../models/User.js";
import Agent from "../models/Agent.js";
import Session from "../models/Session.js";

const authenticate = async (req, res, next) => {
  const token = req.cookies.token;
  if (!token) return res.status(401).json({ message: "No token provided" });

  try {
    const decoded = await verifyToken(token);
    const user = await User.findById(decoded.userId);
    if (!user) return res.status(404).json({ message: "User not found" });

    req.user = user;
    req.sessionId = decoded.sessionId;

    if (user.role === "agent") {
      const agent = await Agent.findOne({ user: user._id });
      // Don't RETURN 403 here yet, just attach it if found
      if (agent) {
        req.agent = agent;
      }
    }

    if (req.sessionId) {
      await Session.findByIdAndUpdate(req.sessionId, {
        lastActive: new Date(),
      });
    }

    next();
  } catch (error) {
    // If the error is "JWT expired", axios will catch this 401 and handle it
    res.status(401).json({ message: "Unauthorized", error: error.message });
  }
};

const optionalAuthenticate = async (req, res, next) => {
  const token = req.cookies.token;
  if (!token) return next();

  try {
    const decoded = await verifyToken(token);
    const user = await User.findById(decoded.userId).select("-password");
    if (user) {
      req.user = user;
      req.sessionId = decoded.sessionId;
    }
  } catch (error) {
    // Ignore error for optional auth
  }
  next();
};

const restrictTo = (...roles) => {
  return (req, res, next) => {
    if (!roles.includes(req.user.role)) {
      return res.status(403).json({ message: "Access denied" });
    }
    next();
  };
};

export { authenticate, optionalAuthenticate, restrictTo };
