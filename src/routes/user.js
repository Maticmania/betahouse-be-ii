// src/routes/user.js
import express from 'express';
import {
  listUsers,
  deleteUser,
  addAgentReview,
  getAgentProfile,
  getAllAgents,
  updateProfile,
  updateUserProfile,
  deleteUserSelf,
  updateEmail,
  updatePassword
} from '../controllers/user/user.controller.js';
import { authenticate, restrictTo } from '../middlewares/auth.middleware.js';
import {upload} from '../middlewares/upload.middleware.js'; 

const router = express.Router();


router.put('/profile', authenticate, upload.single('photo'), updateProfile);
router.get('/', authenticate, restrictTo('admin'), listUsers);
router.put('/email', authenticate, updateEmail);
router.put('/password', authenticate, updatePassword);
router.put('/:id/profile', authenticate, restrictTo('admin'), upload.single('photo'), updateUserProfile);
router.delete('/self', authenticate, deleteUserSelf);
router.delete('/:id', authenticate, restrictTo('admin'), deleteUser);
router.post('/:agentId/review', authenticate, restrictTo('user'), addAgentReview);
router.get('/:agentId/profile', getAgentProfile);
router.get('/agents', getAllAgents); 

export default router;