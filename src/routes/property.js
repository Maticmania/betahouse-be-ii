// src/routes/property.js
import express from 'express';
import {
  createProperty,
  updateProperty,
  deleteProperty,
  listProperties,
  getProperty,
  toggleWishlist,
  updatePropertyStatus,
  toggleFeatured,
} from '../controllers/property/property.controller.js';
import { authenticate, restrictTo } from '../middlewares/auth.middleware.js';
import multer from 'multer';

const router = express.Router();

// Configure Multer for file uploads
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, 'uploads/');
  },
  filename: (req, file, cb) => {
    cb(null, `${Date.now()}-${file.originalname}`);
  },
});
const upload = multer({ storage, limits: { files: 30 } }); // Limit to 30 files

// Routes
router.post('/', authenticate, restrictTo('agent'), upload.array('images', 30), createProperty);
router.put('/:id', authenticate, restrictTo('agent'), upload.array('images', 30), updateProperty);
router.delete('/:id', authenticate, restrictTo('agent', 'admin'), deleteProperty);
router.get('/', listProperties);
router.get('/:id', getProperty);
router.post('/:id/wishlist', authenticate, restrictTo('user'), toggleWishlist);
router.put('/:id/status', authenticate, restrictTo('admin'), updatePropertyStatus);
router.put('/:id/featured', authenticate, restrictTo('admin'), toggleFeatured);

export default router;