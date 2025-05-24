// src/routes/user.js
import express from 'express';
import {
  listUsers,
  updateUser,
  deleteUser,
  addAgentReview,
  getAgentProfile,
  getAllAgents,
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
router.put('/:id', authenticate, upload.single('photo'), updateUser);
router.delete('/:id', authenticate, restrictTo('admin'), deleteUser);
router.post('/:agentId/review', authenticate, restrictTo('user'), addAgentReview);
router.get('/:agentId/profile', getAgentProfile);
router.get('/agents', getAllAgents); // New route to get all agents

export default router;