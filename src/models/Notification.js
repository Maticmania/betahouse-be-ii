import mongoose from "mongoose";

const NotificationSchema = new mongoose.Schema(
  {
    user: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
      index: true,
    },
    title: {
      type: String,
    },
    type: {
      type: String,
      enum: [
        "message",
        "property",
        "system",
        "kyc_submitted",
        "kyc_approved",
        "kyc_rejected",
        "profile_updated",
        "agent_review",
      ],
      required: true,
    },
    content: {
      type: String,
      required: true,
    },
    relatedId: { type: String, required: true },
    
    relatedModel: {
      type: String,
      enum: [
        "Property",
        "Message",
        "System",
        "AgentKYC",
        "User",
        "AgentApplication",
      ],
      default: null,
    },
    read: {
      type: Boolean,
      default: false,
    },
  },
  {
    timestamps: true,
  }
);

export default mongoose.model("Notification", NotificationSchema);
