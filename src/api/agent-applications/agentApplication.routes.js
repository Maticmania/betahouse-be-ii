import { Router } from 'express';
import * as AgentApplicationController from './agentApplication.controller.js';
import { authenticate, restrictTo } from '../../middlewares/auth.middleware.js';

const router = Router();

// @route   GET /api/agent-applications
// @desc    Get all applications (admin only)
// @access  Private (Admin)
router.get('/', authenticate, restrictTo('admin'), AgentApplicationController.getApplications);

// @route   POST /api/agent-applications
// @desc    Create a new agent application
// @access  Private
router.post('/', authenticate, AgentApplicationController.createApplication);

// @route   GET /api/agent-applications/status
// @desc    Get the status of the user's application
// @access  Private
router.get('/status', authenticate, AgentApplicationController.getMyApplicationStatus);

// @route   GET /api/agent-applications/user/me
// @desc    Get the application for the current user
// @access  Private
router.get('/user/me', authenticate, AgentApplicationController.getMyApplication);

// @route   GET /api/agent-applications/:id
// @desc    Get an application by its ID
// @access  Private
router.get('/:id', authenticate, AgentApplicationController.getApplicationById);

// @desc    Save progress on the user's application
// @access  Private
router.put('/save', authenticate, AgentApplicationController.saveMyApplication);

// @route   PATCH /api/agent-applications/submit
// @desc    Submit the user's application
// @access  Private
router.patch('/submit', authenticate, AgentApplicationController.submitMyApplication);

// @route   PATCH /api/agent-applications/:id/status
// @desc    Update an application's status (Admin)
// @access  Private (Admin)
router.patch('/:id/status', authenticate, restrictTo('admin'), AgentApplicationController.updateApplicationStatus);

// @route   DELETE /api/agent-applications/:id
// @desc    Delete an application
// @access  Private
// router.delete('/:id', authenticate, AgentApplicationController.deleteApplication);

export default router;
