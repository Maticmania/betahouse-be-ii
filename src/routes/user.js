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
  deleteUserSelf
} from '../controllers/user/user.controller.js';
import { authenticate, restrictTo } from '../middlewares/auth.middleware.js';
import multer from 'multer';

const router = express.Router();

const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, 'uploads/');
  },
  filename: (req, file, cb) => {
    cb(null, `${Date.now()}-${file.originalname}`);
  },
});
const upload = multer({ storage });

router.get('/', authenticate, restrictTo('admin'), listUsers);
router.put('/profile', authenticate, upload.single('photo'), updateProfile);
router.put('/:id/profile', authenticate, restrictTo('admin'), upload.single('photo'), updateUserProfile);
router.delete('/self', authenticate, deleteUserSelf);
router.delete('/:id', authenticate, restrictTo('admin'), deleteUser);
router.post('/:agentId/review', authenticate, restrictTo('user'), addAgentReview);
router.get('/:agentId/profile', getAgentProfile);
router.get('/agents', getAllAgents); 

export default router;