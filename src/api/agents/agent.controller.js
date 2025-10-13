import * as agentService from "./agent.service.js";

// Save draft application
const saveApplication = async (req, res) => {
  try {
    if (!req.user) {
      return res.status(401).json({ message: "Please log in to continue" });
    }
    const application = await agentService.saveApplication(
      req.user,
      req.body,
      "draft"
    );
    res
      .status(201)
      .json({ message: "Application saved as draft", application });
  } catch (error) {
    console.log(error);
    res.status(500).json({ message: "Server error", error: error.message });
  }
};

// Submit final application
const submitApplication = async (req, res) => {
  try {
    const application = await agentService.saveApplication(
      req.user,
      req.body,
      "submitted"
    );
    res
      .status(201)
      .json({ message: "Application submitted, pending review", application });
  } catch (error) {
    console.log(error);
    res.status(500).json({ message: "Server error", error: error.message });
  }
};

// Get single application (for admin or user if allowed)
const getApplication = async (req, res) => {
  try {
    const { applicationId } = req.params;
    const application = await agentService.getApplication(applicationId);
    res.status(200).json(application);
  } catch (error) {
    res.status(500).json({ message: "Server error", error: error.message });
  }
};

// Get applications for logged-in user
const getUserApplications = async (req, res) => {
  try {
    const applications = await agentService.getUserApplications(req.user._id);
    res.status(200).json(applications);
  } catch (error) {
    res.status(500).json({ message: "Server error", error: error.message });
  }
};

// Admin: review application
const reviewApplication = async (req, res) => {
  try {
    const { applicationId } = req.params;
    const { status, rejectionReason } = req.body;
    const application = await agentService.reviewApplication(
      applicationId,
      status,
      req.user._id,
      rejectionReason,
      req.app.get("io"),
      req.app.get("onlineUsers")
    );
    res.status(200).json({ message: `Application ${status}`, application });
  } catch (error) {
    res.status(500).json({ message: "Server error", error: error.message });
  }
};

// Admin: list applications
const listApplications = async (req, res) => {
  try {
    const { page = 1, limit = 10, status } = req.query;
    const result = await agentService.listApplications(page, limit, status);
    res.status(200).json(result);
  } catch (error) {
    res.status(500).json({ message: "Server error", error: error.message });
  }
};

export {
  saveApplication,
  submitApplication,
  getApplication,
  getUserApplications,
  reviewApplication,
  listApplications,
};
