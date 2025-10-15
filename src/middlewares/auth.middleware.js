import { verifyToken } from "../utils/auth.js";
import User from "../models/User.js";
import Agent from "../models/Agent.js";
import Session from "../models/Session.js";

const authenticate = async (req, res, next) => {
  const token = req.headers.authorization?.split(" ")[1];
  if (!token) return res.status(401).json({ message: "No token provided" });

  try {
    const decoded = await verifyToken(token);
    const user = await User.findById(decoded.userId);
    if (!user) return res.status(404).json({ message: "User not found" });

    if (user.role === "agent") {
      const agent = await Agent.findOne({ user: user._id });
      if (agent) {
        req.agent = agent;
      }
    }

    req.user = user;
    req.sessionId = decoded.sessionId;

    if (req.sessionId) {
      await Session.findByIdAndUpdate(req.sessionId, { lastActive: new Date() });
    }

    next();
  } catch (error) {
    res.status(401).json({ message: "Unauthorized", error: error.message });
  }
};

const restrictTo = (...roles) => {
  return (req, res, next) => {
    if (!roles.includes(req.user.role)) {
      return res.status(403).json({ message: "Access denied" });
    }
    next();
  };
};

const optionalAuthenticate = async (req, res, next) => {
  const authHeader = req.headers.authorization;
  if (!authHeader) return next(); // No token? proceed

  const token = authHeader.split(" ")[1];
  if (!token) return next(); // Still no token? proceed

  try {
    const decoded = await verifyToken(token);
    const user = await User.findById(decoded.userId).select("-password");
    if (user) {
      req.user = user;
      req.sessionId = decoded.sessionId;
    }
  } catch (error) {
    // Invalid token? Ignore and proceed unauthenticated
  }

  next();
};

export { authenticate, optionalAuthenticate, restrictTo };
