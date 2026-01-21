/**
 * MinIO client configuration
 */
import { Client as MinioClient } from 'minio';
import { env } from './env.js';
import { logger } from './logger.js';

export const minio = new MinioClient({
  endPoint: env.MINIO_ENDPOINT,
  port: env.MINIO_PORT,
  useSSL: env.MINIO_USE_SSL,
  accessKey: env.MINIO_ACCESS_KEY,
  secretKey: env.MINIO_SECRET_KEY,
});

export async function initMinio(): Promise<void> {
  try {
    const bucketExists = await minio.bucketExists(env.MINIO_BUCKET);
    if (!bucketExists) {
      await minio.makeBucket(env.MINIO_BUCKET, 'us-east-1');
      logger.info({ bucket: env.MINIO_BUCKET }, 'Created MinIO bucket');
    }
  } catch (error) {
    logger.error({ error }, 'Failed to initialize MinIO');
    throw error;
  }
}

export async function checkMinioHealth(): Promise<boolean> {
  try {
    await minio.listBuckets();
    return true;
  } catch (error) {
    logger.error({ error }, 'MinIO health check failed');
    return false;
  }
}
