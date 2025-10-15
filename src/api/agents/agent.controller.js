
import * as AgentService from "./agent.service.js";

export const getAllAgents = async (req, res) => {
  try {
    const agents = await AgentService.getAllAgents();
    res.status(200).json({ data: agents });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

export const getAgentByAgentId = async (req, res) => {
  try {
    const { agentId } = req.params;
    const agent = await AgentService.getAgentByAgentId(agentId);
    if (!agent) {
      return res.status(404).json({ message: "Agent not found" });
    }
    res.status(200).json(agent);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

export const getAgentProfile = async (req, res) => {
  try {
    res.status(200).json(req.agent);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

export const updateAgentProfile = async (req, res) => {
  try {
    const agent = await AgentService.updateAgent(req.agent.agentId, req.body);
    if (!agent) {
      return res.status(404).json({ message: "Agent not found" });
    }
    res.status(200).json(agent);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

export const getTopRatedAgents = async (req, res) => {
  try {
    const agents = await AgentService.getTopRatedAgents();
    res.status(200).json(agents);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};
