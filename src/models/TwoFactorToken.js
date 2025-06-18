// models/TwoFactorToken.js
import mongoose from "mongoose";

const TwoFactorTokenSchema = new mongoose.Schema(
  {
    user: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
      index: true,
    },
    code: {
      type: String,
      required: true,
    },
    method: {
      type: String,
      enum: ["email", "phone"],
      required: true,
      default: "email",
    },
    expiresAt: {
      type: Date,
      required: true,
    },
    verified: {
      type: Boolean,
      default: false,
    },
  },
  {
    timestamps: true,
  }
);

export default mongoose.model("TwoFactorToken", TwoFactorTokenSchema);
