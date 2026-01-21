/**
 * Wait for dependent services to be ready
 * Usage: npm run wait
 */
import postgres from 'postgres';
import IORedis from 'ioredis';
import { Client as MinioClient } from 'minio';

// Use native fetch (Node.js 18+)
declare const fetch: typeof globalThis.fetch;

const services = {
  db: false,
  redis: false,
  minio: false,
  vllmChat: false,
  vllmEmbed: false,
  vllmRerank: false,
};

async function waitForPostgres(): Promise<void> {
  const maxAttempts = 30;
  let attempts = 0;

  while (attempts < maxAttempts) {
    try {
      const sql = postgres(process.env.DATABASE_URL || 'postgresql://postgres:postgres@localhost:5432/contract_precheck', {
        max: 1,
      });
      await sql`SELECT 1`;
      await sql.end();
      console.log('✓ PostgreSQL is ready');
      services.db = true;
      return;
    } catch (error) {
      attempts++;
      await new Promise(resolve => setTimeout(resolve, 2000));
    }
  }
  throw new Error('PostgreSQL connection timeout');
}

async function waitForRedis(): Promise<void> {
  const maxAttempts = 30;
  let attempts = 0;

  while (attempts < maxAttempts) {
    try {
      const redis = new IORedis(process.env.REDIS_URL || 'redis://localhost:6379');
      await redis.ping();
      await redis.quit();
      console.log('✓ Redis is ready');
      services.redis = true;
      return;
    } catch (error) {
      attempts++;
      await new Promise(resolve => setTimeout(resolve, 2000));
    }
  }
  throw new Error('Redis connection timeout');
}

async function waitForMinio(): Promise<void> {
  const maxAttempts = 30;
  let attempts = 0;

  while (attempts < maxAttempts) {
    try {
      const minio = new MinioClient({
        endPoint: process.env.MINIO_ENDPOINT || 'localhost',
        port: parseInt(process.env.MINIO_PORT || '9000'),
        useSSL: process.env.MINIO_USE_SSL === 'true',
        accessKey: process.env.MINIO_ACCESS_KEY || 'minioadmin',
        secretKey: process.env.MINIO_SECRET_KEY || 'minioadmin',
      });
      await minio.listBuckets();
      console.log('✓ MinIO is ready');
      services.minio = true;
      return;
    } catch (error) {
      attempts++;
      await new Promise(resolve => setTimeout(resolve, 2000));
    }
  }
  throw new Error('MinIO connection timeout');
}

async function waitForVLLM(name: string, url: string): Promise<void> {
  const maxAttempts = 60;
  let attempts = 0;

  while (attempts < maxAttempts) {
    try {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 5000);

      const response = await fetch(`${url}/health`, {
        signal: controller.signal,
      });

      clearTimeout(timeoutId);

      if (response.ok) {
        console.log(`✓ vLLM ${name} is ready`);
        return;
      }
    } catch (error) {
      attempts++;
      if (attempts % 10 === 0) {
        console.log(`Waiting for vLLM ${name}... (${attempts}/${maxAttempts})`);
      }
      await new Promise(resolve => setTimeout(resolve, 5000));
    }
  }
  throw new Error(`vLLM ${name} connection timeout`);
}

async function main() {
  console.log('Waiting for services to be ready...\n');

  try {
    await Promise.all([
      waitForPostgres(),
      waitForRedis(),
      waitForMinio(),
      waitForVLLM('chat', process.env.VLLM_CHAT_BASE_URL || 'http://localhost:8000/v1'),
      waitForVLLM('embed', process.env.VLLM_EMBED_BASE_URL || 'http://localhost:8001/v1'),
      waitForVLLM('rerank', process.env.VLLM_RERANK_BASE_URL || 'http://localhost:8002/v1'),
    ]);

    console.log('\n✓ All services are ready!');
    process.exit(0);
  } catch (error) {
    console.error('\n✗ Service check failed:', error);
    process.exit(1);
  }
}

main();
