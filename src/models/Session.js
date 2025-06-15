// models/Session.js
import mongoose from "mongoose";
import { UAParser } from "ua-parser-js";

const sessionSchema = new mongoose.Schema(
  {
    user: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true },
    refreshToken: { type: String, required: true },
    ipAddress: { type: String },
    device: {
      type: Object, // Parsed result from ua-parser-js
    },
    location: {
      city: String,
      region: String,
      country: String,
      loc: String, // lat,long string
    },
    lastActive: { type: Date, default: Date.now },
    createdAt: { type: Date, default: Date.now },
  },
  { timestamps: true }
);

export default mongoose.model("Session", sessionSchema);
