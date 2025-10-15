
import express from "express";
import * as AgentController from "./agent.controller.js";
import { authenticate, restrictTo } from "../../middlewares/auth.middleware.js";

const router = express.Router();

router.get("/", AgentController.getAllAgents);
router.get("/profile", authenticate, restrictTo("agent"), AgentController.getAgentProfile);
router.put("/profile", authenticate, restrictTo("agent"), AgentController.updateAgentProfile);
router.get("/top-rated", AgentController.getTopRatedAgents);
router.get("/:agentId", AgentController.getAgentByAgentId);

export default router;
