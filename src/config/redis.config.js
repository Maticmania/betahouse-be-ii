// src/config/redis.js
import Redis from 'ioredis';
import dotenv from 'dotenv';

dotenv.config();

let attempts = 0;
const maxAttempts = 3;

const redisClient = new Redis(process.env.REDIS_URL, {
  retryStrategy(times) {
    attempts++;
    if (attempts > maxAttempts) {
      console.error('❌ Redis connection failed after 3 attempts.');
      return null; // Stop retrying
    }
    console.warn(`⚠️ Redis retrying... attempt ${attempts}`);
    return 1000 * attempts; // Delay between retries (e.g., 1s, 2s, 3s)
  },
});

redisClient.on('connect', () => {
  console.log('✅ Redis connected');
  attempts = 0; // Reset on successful connect
});

redisClient.on('error', (err) => {
  console.error('❌ Redis error:', err.message);
});

export default redisClient;
