import Agent from "../../models/Agent.js";
import redisClient from "../../config/redis.config.js";
import { getCache, setCache } from "../../utils/cache.js";

/** 🔄 Invalidate all cached agents */
export const invalidateAgentCache = async () => {
  try {
    const keys = await redisClient.keys("agents:*");
    if (keys.length > 0) await redisClient.del(keys);
  } catch (err) {
    console.error("Failed to invalidate agent cache:", err.message);
  }
};

export const createAgent = async (agentData) => {
  const agent = new Agent(agentData);
  await agent.save();
  await invalidateAgentCache();
  return agent;
};

export const getAllAgents = async () => {
  const cacheKey = "agents:all";
  const cached = await getCache(cacheKey);
  if (cached) return cached;

  const agents = await Agent.find(
    {},
    {
      "documents.licenseDocument": 0,
      "documents.idDocument": 0,
      "documents.certificationDocuments": 0,
      "documents.businessRegistration": 0,
    }
  ).populate("user", "-password");

  await setCache(cacheKey, agents);
  return agents;
};

export const getAgentByAgentId = async (agentId) => {
  const cacheKey = `agents:${agentId}`;
  const cached = await getCache(cacheKey);
  if (cached) return cached;

  const agent = await Agent.findOne(
    { agentId },
    {
      "documents.licenseDocument": 0,
      "documents.idDocument": 0,
      "documents.certificationDocuments": 0,
      "documents.businessRegistration": 0,
    }
  ).populate("user", "-password");

  if (agent) await setCache(cacheKey, agent);
  return agent;
};

export const updateAgent = async (agentId, agentData) => {
  const agent = await Agent.findOneAndUpdate({ agentId }, agentData, {
    new: true,
  });
  await invalidateAgentCache();
  return agent;
};

export const getTopRatedAgents = async () => {
  const cacheKey = "agents:top-rated";
  const cached = await getCache(cacheKey);
  if (cached) return cached;

  const agents = await Agent.find({})
    .populate({
      path: "user",
      select: "-password",
    })
    .sort({ "ratings.average": -1 })
    .limit(10);

  await setCache(cacheKey, agents);
  return agents;
};
