import AgentApplication from "../../models/AgentApplication.js";
import User from "../../models/User.js";
import { createNotification } from "../notifications/notification.service.js";


const saveApplication = async (user, applicationData, status = "draft") => {
  if (user.role !== "user") {
    throw new Error("Only regular users can apply to become agents");
  }

  let application = await AgentApplication.findOne({ user: user._id });

  if (!application) {
    application = new AgentApplication({ user: user._id });
  }

  // Merge basic data
  application.personal = applicationData.personal || application.personal;
  application.professional = applicationData.professional || application.professional;
  application.business = applicationData.business || application.business;

  // Just store the Cloudinary file references from frontend
  if (applicationData.documents) {
    application.documents = {
      ...application.documents,
      ...applicationData.documents,
    };
  }

  application.status = status;
  application.updatedAt = Date.now();
  if (status === "submitted") {
    application.submittedAt = Date.now();
  }

  await application.save();
  return application;
};


// Get single application (by user or admin)
const getApplication = async (applicationId) => {
  const application = await AgentApplication.findById(applicationId)
    .populate("user", "email profile.name role")
    .populate("reviewer", "profile.name");
  if (!application) throw new Error("Application not found");
  return application;
};

// Get applications for logged in user
const getUserApplications = async (userId) => {
  return await AgentApplication.find({ user: userId }).sort({ createdAt: -1 });
};

// Admin review
const reviewApplication = async (applicationId, status, reviewerId, rejectionReason, io, onlineUsers) => {
  if (!["approved", "rejected", "under_review"].includes(status)) {
    throw new Error("Invalid status");
  }

  const application = await AgentApplication.findById(applicationId);
  if (!application) throw new Error("Application not found");

  application.status = status;
  application.reviewedAt = Date.now();
  application.reviewer = reviewerId;

  if (status === "rejected") {
    application.rejectionReason = rejectionReason || "No reason provided";
  }

  if (status === "approved") {
    const user = await User.findById(application.user);
    if (user.role !== "agent") {
      user.role = "agent";
      await user.save();
    }
  }

  await application.save();

  await createNotification(
    io,
    onlineUsers,
    application.user,
    `application_${status}`,
    `Your agent application has been ${status}. ${
      status === "rejected" ? `Reason: ${application.rejectionReason}` : ""
    }`,
    application._id,
    "Agent Application Status",
    "AgentApplication"
  );

  return application;
};

// Admin list applications with pagination
const listApplications = async (page, limit, status) => {
  const query = status ? { status } : {};

  const applications = await AgentApplication.find(query)
    .populate("user", "email profile.name")
    .populate("reviewer", "profile.name")
    .sort({ submittedAt: -1 })
    .skip((page - 1) * limit)
    .limit(Number(limit))
    .lean();

  const total = await AgentApplication.countDocuments(query);

  return {
    applications,
    total,
    page: Number(page),
    pages: Math.ceil(total / limit),
  };
};

export {
  saveApplication,
  getApplication,
  getUserApplications,
  reviewApplication,
  listApplications,
};
