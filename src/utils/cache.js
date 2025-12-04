import redisClient from "../config/redis.config.js";

export const setCache = async (key, value, ttl = 3600) => {
  try {
    const serialized = typeof value === "string" ? value : JSON.stringify(value);

    // Redis v4 modern API: .set(key, value, {EX: ttl})
    if (redisClient.set.length === 3) {
      // set(key, value, options)
      await redisClient.set(key, serialized, { EX: ttl });
      return;
    }

    // Redis v3/v4-legacy API: set(key, value, "EX", ttl)
    if (redisClient.set.length === 4) {
      await redisClient.set(key, serialized, "EX", ttl);
      return;
    }

    // Redis v3 explicit: setex(ttl)
    if (typeof redisClient.setex === "function") {
      await redisClient.setex(key, ttl, serialized);
      return;
    }

    console.error("No compatible Redis set method found");
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
