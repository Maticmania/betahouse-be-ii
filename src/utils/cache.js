import redisClient from "../config/redis.config.js";

export const setCache = async (key, value, ttl = 3600) => {
  try {
    if (typeof redisClient.setEx === "function") {
      await redisClient.setEx(key, ttl, value);
    } else {
      await redisClient.set(key, value, "EX", ttl);
    }
  } catch (err) {
    console.error(`Failed to cache data for key ${key}:`, err.message);
  }
};

export const getCache = async (key) => {
  try {
    const data = await redisClient.get(key);
    return data ? JSON.parse(data) : null;
  } catch (err) {
    console.error(`Failed to retrieve cache for key ${key}:`, err.message);
    return null;
  }
};