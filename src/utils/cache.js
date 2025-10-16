import redisClient from "../config/redis.config.js";

/** Helper: set cache with optional TTL (default 1 hour) */

export const setCache = async (key, value, ttl = 3600) => {
  const stringValue = value;
  if (typeof redisClient.setEx === "function") {
    await redisClient.setEx(key, ttl, stringValue);
  } else {
    await redisClient.set(key, stringValue, "EX", ttl);
  }
};

/** Helper: safely get cache */
export const getCache = async (key) => {
  const data = await redisClient.get(key);
  return data ? JSON.parse(data) : null;
};