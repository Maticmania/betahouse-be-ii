import redis from '../config/redis.config.js';

// Add token to blacklist
export const blacklistToken = async (token, exp) => {
  const key = `bl:${token}`;
  // exp is in seconds (token expiry timestamp)
  const ttl = exp - Math.floor(Date.now() / 1000); // time-to-live in seconds
  if (ttl > 0) {
    await redis.setex(key, ttl, '1');
  }
};

// Check if token is blacklisted
export const isTokenBlacklisted = async (token) => {
  const key = `bl:${token}`;
  const result = await redis.get(key);
  return result === '1';
};
