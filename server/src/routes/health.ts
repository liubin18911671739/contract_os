/**
 * Health check route
 */
import { FastifyInstance } from 'fastify';
import { checkDbHealth } from '../config/db.js';
import { checkRedisHealth } from '../config/redis.js';
import { checkMinioHealth } from '../config/minio.js';
import { modelGateway } from '../llm/modelGateway.js';

export async function healthRoutes(fastify: FastifyInstance) {
  fastify.get('/health', async (request, reply) => {
    const startTime = Date.now();

    const [db, redis, minio, vllm] = await Promise.all([
      checkDbHealth(),
      checkRedisHealth(),
      checkMinioHealth(),
      modelGateway.healthCheck(),
    ]);

    const latency = {
      db: Date.now() - startTime,
      redis: Date.now() - startTime,
      minio: Date.now() - startTime,
      vllm: Date.now() - startTime,
    };

    const allHealthy = db && redis && minio && vllm.chat && vllm.embed && vllm.rerank;

    reply.code(allHealthy ? 200 : 503).send({
      status: allHealthy ? 'ok' : 'error',
      services: {
        db,
        redis,
        minio,
        vllm,
      },
      latency,
    });
  });
}
