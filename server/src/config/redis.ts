/**
 * Redis connection
 */
import IORedis from 'ioredis';
import { env } from './env.js';
import { logger } from './logger.js';

export const redis = new IORedis(env.REDIS_URL, {
  maxRetriesPerRequest: null,
  retryStrategy: (times) => {
    if (times > 3) return null;
    return Math.min(times * 100, 3000);
  },
});

redis.on('error', (error) => {
  logger.error({ error }, 'Redis error');
});

redis.on('connect', () => {
  logger.info('Redis connected');
});

export async function checkRedisHealth(): Promise<boolean> {
  try {
    const result = await redis.ping();
    return result === 'PONG';
  } catch (error) {
    logger.error({ error }, 'Redis health check failed');
    return false;
  }
}

export async function closeRedis(): Promise<void> {
  await redis.quit();
}
