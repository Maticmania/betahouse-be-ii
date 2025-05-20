import redis from '../config/redis.config.js';

// Key pattern: active:<userId>:<token>

export const storeSession = async (userId, token, exp) => {
  const key = `active:${userId}:${token}`;
  const ttl = exp - Math.floor(Date.now() / 1000);
  if (ttl > 0) {
    await redis.setex(key, ttl, '1');
  }
};

export const getUserSessions = async (userId) => {
  const pattern = `active:${userId}:*`;
  const keys = await redis.keys(pattern);
  return keys.map((key) => key.split(':')[2]);
};

export const deleteAllSessions = async (userId) => {
  const keys = await redis.keys(`active:${userId}:*`);
  if (keys.length > 0) {
    await redis.del(...keys);
  }
};
