import * as AgentApplicationService from './agentApplication.service.js';

/**
 * Controller to create a new agent application
 */
export const createApplication = async (req, res) => {
  try {
    const userId = req.user._id;

    const application = await AgentApplicationService.createApplication(req.body, userId);
    res.status(201).json({ message: 'Application created successfully', data: application });
  } catch (error) {
    if (error.message.includes('already exists')) {
      return res.status(409).json({ message: error.message });
    }
    res.status(400).json({ message: 'Error creating application', error: error.message });
  }
};

/**
 * Controller to get an application by its ID
 */
export const getApplicationById = async (req, res) => {
  try {
    const { id } = req.params;
    const application = await AgentApplicationService.getApplicationById(id);

    if (!application) {
      return res.status(404).json({ message: 'Application not found' });
    }
    res.status(200).json({ data: application });
  } catch (error) {
    res.status(400).json({ message: 'Error fetching application', error: error.message });
  }
};

/**
 * Controller to get the application for the currently authenticated user
 */
export const getMyApplication = async (req, res) => {
  try {
    const userId = req.user._id;
    const application = await AgentApplicationService.getApplicationByUserId(userId);

    if (!application) {
      return res.status(404).json({ message: 'You have not created an application yet' });
    }

    res.status(200).json({ data: application });
  } catch (error) {
    console.error('Error fetching your application:', error);
    res.status(400).json({ message: 'Error fetching your application', error: error.message });
  }
};

/**
 * Controller to get all applications (for admins)
 */
export const getApplications = async (req, res) => {
  try {
    const applications = await AgentApplicationService.getApplications(req.query);
    res.status(200).json({ count: applications.length, data: applications });
  } catch (error) {
    res.status(400).json({ message: 'Error fetching applications', error: error.message });
  }
};

/**
 * Controller to update an application (save progress)
 */
export const saveMyApplication = async (req, res) => {
  try {
    const userId = req.user._id;

    const updatedApplication = await AgentApplicationService.updateApplicationByUserId(userId, req.body);

    res.status(200).json({ message: 'Application progress saved successfully', data: updatedApplication });
  } catch (error) {
    // Determine the correct status code based on the error message
    if (error.message.includes('not found')) {
      return res.status(404).json({ message: error.message });
    }
    if (error.message.includes('cannot be edited')) {
      return res.status(403).json({ message: error.message });
    }
    res.status(400).json({ message: 'Error saving application', error: error.message });
  }
};

/**
 * Controller to submit an application
 */
export const submitMyApplication = async (req, res) => {
  try {
    const user = req.user;
    const io = req.app.get('io');
    const onlineUsers = req.app.get('onlineUsers');

    const submittedApplication = await AgentApplicationService.submitApplicationByUserId(io, onlineUsers, user);
    res.status(200).json({ message: 'Application submitted successfully', data: submittedApplication });
  } catch (error) {
    if (error.message.includes('not found')) {
      return res.status(404).json({ message: error.message });
    }
    if (error.message.includes('already been submitted')) {
      return res.status(403).json({ message: error.message });
    }
    res.status(400).json({ message: 'Error submitting application', error: error.message });
  }
};

/**
 * Controller to update an application's status (Admin)
 */
export const updateApplicationStatus = async (req, res) => {
  try {
    const { id } = req.params;
    const { status, rejectionReason } = req.body;
    const adminId = req.user._id;
    const io = req.app.get('io');
    const onlineUsers = req.app.get('onlineUsers');

    if (!status) {
      return res.status(400).json({ message: 'A new status is required' });
    }

    const updatedApplication = await AgentApplicationService.updateApplicationStatus(
      io,
      onlineUsers,
      id,
      status,
      rejectionReason,
      adminId
    );

    res.status(200).json({ message: `Application status updated to ${status}` , data: updatedApplication });
  } catch (error) {
    if (error.message === 'Application not found') {
      return res.status(404).json({ message: error.message });
    }
    // For validation or business rule errors
    if (error.message.includes('required') || error.message.includes('Invalid') || error.message.includes('must be submitted')) {
      return res.status(400).json({ message: error.message });
    }
    res.status(500).json({ message: 'Error updating application status', error: error.message });
  }
};

/**
 * Controller to delete an application
 */
export const getMyApplicationStatus = async (req, res) => {
  try {
    const userId = req.user._id;
    const application = await AgentApplicationService.getApplicationByUserId(userId);

    if (!application) {
      return res.status(404).json({ message: 'Application not found' });
    }

    res.status(200).json({ status: application.status });
  } catch (error) {
    res.status(500).json({ message: 'Error fetching application status', error: error.message });
  }
};
