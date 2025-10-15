import { createAgent } from "../agents/agent.service.js";
import AgentApplication from "../../models/AgentApplication.js";
import { sendAgentApplicationConfirmationEmail, sendAgentApplicationApprovedEmail, sendAgentApplicationRejectedEmail } from "../../services/email.js";
import { createNotification } from "../../services/notification.js";
import User from "../../models/User.js";


const generateApplicationId = () => {
  return `BH-AGENT-${new Date().getFullYear()}-${Math.random().toString(36).substring(2, 10).toUpperCase()}`;
};

export const createApplication = async (applicationData, userId) => {
  const existingApplication = await AgentApplication.findOne({ user: userId });
  if (existingApplication) {
    throw new Error("An application for this user already exists.");
  }

  const { personal, professional, business, documents } = applicationData;

  const application = new AgentApplication({
    user: userId,
    applicationId: generateApplicationId(),
    status: "draft",
    personal,
    professional,
    business,
    documents,
  });

  await application.save();
  return application;
};


export const getApplicationByApplicationId = async (applicationId) => {
  return AgentApplication.findOne({ applicationId }).populate(
    "user",
    "firstName lastName email"
  );
};

export const getApplicationByUserId = async (userId) => {
  return AgentApplication.findOne({ user: userId }).populate(
    "user",
    "firstName lastName email"
  );
};

export const getApplications = async (query) => {
  // Build a filter object from the query
  const filter = {};
  if (query.status) {
    filter.status = query.status;
  }
  // Add more filters as needed

  return AgentApplication.find(filter)
    .populate("user", "firstName lastName email")
    .sort({ createdAt: -1 });
};


export const updateApplicationByUserId = async (userId, updateData) => {
  const application = await AgentApplication.findOne({ user: userId });

  if (!application) {
    throw new Error("Application not found for this user.");
  }

  // Ensure the application is in draft status
  if (application.status !== "draft") {
    throw new Error(
      "Application has already been submitted and cannot be edited"
    );
  }

  // Handle partial updates for nested objects
  const { personal, professional, business, documents } = updateData;

  if (personal) {
    application.personal = { ...application.personal, ...personal };
  }
  if (professional) {
    application.professional = { ...application.professional, ...professional };
  }
  if (business) {
    application.business = { ...application.business, ...business };
  }
  if (documents) {
    application.documents = { ...application.documents, ...documents };
  }

  application.updatedAt = Date.now();

  await application.save();
  return application;
};

export const submitApplicationByUserId = async (io, onlineUsers, user) => {
  const { _id: userId, email, firstName } = user;

  const application = await AgentApplication.findOne({ user: userId });

  if (!application) {
    throw new Error("Application not found for this user.");
  }

  // Ensure the application is in draft status
  if (application.status !== "draft") {
    throw new Error("Application has already been submitted");
  }

  // Update status and submission timestamp
  application.personal.email = email;
  application.status = "submitted";
  application.submittedAt = Date.now();
  application.updatedAt = Date.now();

  await application.save();

  // Send email confirmation
  const dashboardLink = `${process.env.FRONTEND_URL}/become-agent/status`; 
  await sendAgentApplicationConfirmationEmail(
    email,
    firstName,
    application.applicationId,
    dashboardLink
  );

  // Create in-app notification for the user
  await createNotification(
    io,
    onlineUsers,
    userId,
    "system",
    "Your agent application has been successfully submitted and is now under review. Application ID: " + application.applicationId,
    application._id,
    "Agent Application Submitted",
    "AgentApplication"
  );

  return application;
};


const generateAgentId = () => {
  return `BH-AGENT-${new Date().getFullYear()}-${Math.random().toString(36).substring(2, 10).toUpperCase()}`;
};

export const updateApplicationStatus = async (
  io,
  onlineUsers,
  applicationId,
  status,
  rejectionReason,
  adminId
) => {
  const application = await getApplicationByApplicationId(applicationId);

  if (!application) {
    throw new Error("Application not found");
  }

  if (!["submitted", "under_review"].includes(application.status)) {
    throw new Error("Application must be submitted before it can be reviewed.");
  }

  const allowedStatusUpdates = ["under_review", "approved", "rejected"];
  if (!allowedStatusUpdates.includes(status)) {
    throw new Error(
      `Invalid status update. Must be one of: ${allowedStatusUpdates.join(", ")}`
    );
  }

  if (status === "rejected" && !rejectionReason) {
    throw new Error("A reason for rejection is required.");
  }

  application.status = status;

  if (status === "approved") {
    await User.findByIdAndUpdate(application.user, { role: "agent" });

    const agentData = {
      user: application.user,
      agentId: generateAgentId(),
      personal: application.personal,
      professional: application.professional,
      business: application.business,
      documents: application.documents,
    };
    await createAgent(agentData);
  }
  application.reviewer = adminId;
  application.reviewedAt = Date.now();
  application.updatedAt = Date.now();
  if (status === "rejected") {
    application.rejectionReason = rejectionReason;
  } else {
    application.rejectionReason = undefined;
  }

  await application.save();

  const user = await User.findById(application.user);

  if (status === "approved") {
    await sendAgentApplicationApprovedEmail(
      user.email,
      user.profile.name || user.firstName,
      application.applicationId
    );
  } else if (status === "rejected") {
    await sendAgentApplicationRejectedEmail(
      user.email,
      user.profile.name || user.firstName,
      application.applicationId,
      rejectionReason
    );
  }

  let notificationContent = `Your agent application status has been updated to: ${status.replace(
    /_/g,
    " "
  )}.`;
  let notificationTitle = "Application Status Update";
  if (status === "rejected" && rejectionReason) {
    notificationContent += ` Reason: ${rejectionReason}`;
  }

await createNotification(
  io,
  onlineUsers,
  application.user._id,
  "system",
  notificationContent + `. Application ID: ${application.applicationId}`,
  application._id,
  notificationTitle,
  "AgentApplication"
);


  return application.status;
};


export const deleteApplication = async (applicationId, userId, userRole) => {
  const application = await getApplicationByApplicationId(applicationId);

  if (!application) {
    throw new Error("Application not found");
  }

  // Allow admin to delete or user to delete their own application
  if (
    userRole !== "admin" &&
    application.user._id.toString() !== userId.toString()
  ) {
    throw new Error("You are not authorized to delete this application");
  }

  await AgentApplication.findOneAndDelete({ applicationId });
};
