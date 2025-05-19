import Redis from 'ioredis';

export const redisConnect = (url) => {
  const redis = new Redis(url); // No tls:{} now

  redis.on('connect', () => console.log('✅ Redis connected'));
  redis.on('error', (err) => console.error('❌ Redis error:', err));

  return redis;
};

