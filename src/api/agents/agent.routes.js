import express from "express";
import * as agentController from "./agent.controller.js";
import { authenticate, restrictTo } from "../../middlewares/auth.middleware.js";

const router = express.Router();

// Save application
router.post(
  "/applications/save",
  authenticate,
  agentController.saveApplication
);

// Submit final application
router.post(
  "/applications/submit",
  authenticate,
  agentController.submitApplication
);

// Get single application
router.get("/applications/:applicationId", authenticate, agentController.getApplication);

// Get applications for logged-in user
router.get("/applications", authenticate, agentController.getUserApplications);

// Admin: review application
router.put(
  "/applications/review/:applicationId",
  restrictTo("admin"),
  agentController.reviewApplication
);

// Admin: list applications
router.get("/admins/applications", restrictTo("admin"), agentController.listApplications);

export default router;
