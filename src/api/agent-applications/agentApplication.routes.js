import { Router } from 'express';
import * as AgentApplicationController from './agentApplication.controller.js';
import { authenticate, restrictTo } from '../../middlewares/auth.middleware.js';

const router = Router();

router.get('/', authenticate, restrictTo('admin'), AgentApplicationController.getApplications);

router.post('/', authenticate, AgentApplicationController.createApplication);

router.get('/status', authenticate, AgentApplicationController.getMyApplicationStatus);

router.get('/user/me', authenticate, AgentApplicationController.getMyApplication);

router.get('/:applicationId', authenticate, AgentApplicationController.getApplicationByApplicationId);

router.put('/save', authenticate, AgentApplicationController.saveMyApplication);

router.patch('/submit', authenticate, AgentApplicationController.submitMyApplication);

router.patch('/:applicationId/status', authenticate, restrictTo('admin'), AgentApplicationController.updateApplicationStatus);

// router.delete('/:applicationId', authenticate, AgentApplicationController.deleteApplication);

export default router;