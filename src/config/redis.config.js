// src/config/redis.js
import Redis from 'ioredis';
import dotenv from 'dotenv';

dotenv.config();

const redisClient = new Redis(process.env.REDIS_URL);
redisClient.on('error', (err) => console.error('❌Redis error:', err));
redisClient.on('connect', () => console.log('✅Redis connected'));

export default redisClient;