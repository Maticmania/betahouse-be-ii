// src/routes/agent.js
import express from "express";
import {
  submitKYC,
  getKYCStatus,
  reviewKYC,
  listKYCs,
} from "../controllers/agent/agent.controller.js";
import { authenticate, restrictTo } from "../middlewares/auth.middleware.js";
import multer from "multer";

const router = express.Router();

// Configure Multer for file uploads
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, "uploads/");
  },
  filename: (req, file, cb) => {
    cb(null, `${Date.now()}-${file.originalname}`);
  },
});
const upload = multer({ storage });

// Routes
router.post(
  "/kyc",
  authenticate,
  restrictTo("user"),
  upload.fields([
    { name: "idImage", maxCount: 1 },
    { name: "selfieWithCode", maxCount: 1 },
  ]),
  submitKYC
);
router.get("/kyc/status", authenticate, getKYCStatus);
router.put("/kyc/:kycId/review", authenticate, restrictTo("admin"), reviewKYC);
router.get("/kyc/list", authenticate, restrictTo("admin"), listKYCs);

export default router;
