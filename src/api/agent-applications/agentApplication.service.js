import AgentApplication from "../../models/AgentApplication.js";

/**
 * Create a new agent application
 * @param {object} applicationData - The data for the application
 * @param {string} userId - The ID of the user creating the application
 * @returns {Promise<AgentApplication>}
 */
export const createApplication = async (applicationData, userId) => {
  // 1. Check if user already has an application
  const existingApplication = await AgentApplication.findOne({ user: userId });
  if (existingApplication) {
    throw new Error("An application for this user already exists.");
  }

  // 2. Explicitly map fields to prevent mass assignment
  const { personal, professional, business, documents } = applicationData;

  const application = new AgentApplication({
    user: userId,
    status: "draft",
    personal,
    professional,
    business,
    documents,
  });

  // 3. Save and return the new application
  await application.save();
  return application;
};

/**
 * Get an application by its ID
 * @param {string} applicationId - The ID of the application
 * @returns {Promise<AgentApplication>}
 */
export const getApplicationById = async (applicationId) => {
  return AgentApplication.findById(applicationId).populate(
    "user",
    "firstName lastName email"
  );
};

/**
 * Get an application by the user's ID
 * @param {string} userId - The ID of the user
 * @returns {Promise<AgentApplication>}
 */
export const getApplicationByUserId = async (userId) => {
  return AgentApplication.findOne({ user: userId }).populate(
    "user",
    "firstName lastName email"
  );
};

/**
 * Get all applications based on a query
 * @param {object} query - The query object for filtering
 * @returns {Promise<AgentApplication[]>}
 */
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

/**
 * Update an application
 * @param {string} applicationId - The ID of the application
 * @param {object} updateData - The data to update
 * @param {string} userId - The ID of the user making the request
 * @returns {Promise<AgentApplication>}
 */
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

/**
 * Submit an application
 * @param {string} applicationId - The ID of the application
 * @param {string} userId - The ID of the user making the request
 * @returns {Promise<AgentApplication>}
 */
export const submitApplicationByUserId = async (user) => {
  const { _id: userId, email } = user;

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
  return application;
};

/**
 * Update an application's status (Admin)
 * @param {string} applicationId - The ID of the application
 * @param {string} status - The new status
 * @param {string} [rejectionReason] - The reason for rejection (if applicable)
 * @param {string} adminId - The ID of the admin performing the action
 * @returns {Promise<AgentApplication>}
 */
export const updateApplicationStatus = async (
  applicationId,
  status,
  rejectionReason,
  adminId
) => {
  const application = await getApplicationById(applicationId);

  if (!application) {
    throw new Error("Application not found");
  }

  // Ensure the application has been submitted before an admin can review it
  if (!["submitted", "under_review"].includes(application.status)) {
    throw new Error("Application must be submitted before it can be reviewed.");
  }

  // Validate the new status
  const allowedStatusUpdates = ["under_review", "approved", "rejected"];
  if (!allowedStatusUpdates.includes(status)) {
    throw new Error(
      `Invalid status update. Must be one of: ${allowedStatusUpdates.join(
        ", "
      )}`
    );
  }

  // Require a rejection reason if rejecting
  if (status === "rejected" && !rejectionReason) {
    throw new Error("A reason for rejection is required.");
  }

  application.status = status;
  application.reviewer = adminId;
  application.reviewedAt = Date.now();
  application.updatedAt = Date.now();
  if (status === "rejected") {
    application.rejectionReason = rejectionReason;
  } else {
    application.rejectionReason = undefined; // Clear reason if not rejected
  }

  await application.save();
  return application;
};

/**
 * Delete an application
 * @param {string} applicationId - The ID of the application
 * @param {string} userId - The ID of the user making the request
 * @param {string} userRole - The role of the user making the request
 * @returns {Promise<void>}
 */
export const deleteApplication = async (applicationId, userId, userRole) => {
  const application = await getApplicationById(applicationId);

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

  await AgentApplication.findByIdAndDelete(applicationId);
};
