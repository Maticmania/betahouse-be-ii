// src/models/Session.js
import mongoose from 'mongoose';

const SessionSchema = new mongoose.Schema({
  user: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true,
  },
  token: {
    type: String,
    required: true,
  },
  device: {
    type: String, // e.g., "Chrome on Windows"
  },
  ipAddress: {
    type: String,
  },
  lastActive: {
    type: Date,
    default: Date.now,
  },
  createdAt: {
    type: Date,
    default: Date.now,
  },
});

export default mongoose.model('Session', SessionSchema);