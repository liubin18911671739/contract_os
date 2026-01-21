/**
 * Fastify app configuration
 */
import Fastify from 'fastify';
import cors from '@fastify/cors';
import multipart from '@fastify/multipart';
import { logger } from './config/logger.js';
import { initMinio } from './config/minio.js';
import { healthRoutes } from './routes/health.js';
import { taskRoutes } from './routes/tasks.js';
import { contractRoutes } from './routes/contracts.js';
import { kbRoutes } from './routes/kb.js';
import { reportRoutes } from './routes/reports.js';
import { dashboardRoutes } from './routes/dashboard.js';
import { metricsRoutes } from './routes/metrics.js';

export async function buildApp() {
  const app = Fastify({
    logger: false,
    disableRequestLogging: true,
  });

  // Register plugins
  await app.register(cors, {
    origin: true,
    credentials: true,
  });

  await app.register(multipart, {
    limits: {
      fileSize: 100 * 1024 * 1024, // 100MB
    },
  });

  // Register routes
  await app.register(healthRoutes, { prefix: '/api' });
  await app.register(taskRoutes, { prefix: '/api' });
  await app.register(contractRoutes, { prefix: '/api' });
  await app.register(kbRoutes, { prefix: '/api' });
  await app.register(reportRoutes, { prefix: '/api' });
  await app.register(dashboardRoutes, { prefix: '/api' });
  await app.register(metricsRoutes, { prefix: '/api' });

  // Error handler
  app.setErrorHandler((error, request, reply) => {
    logger.error({ error, url: request.url }, 'Request error');

    reply.code(error.statusCode || 500).send({
      error: error.message,
      code: error.code,
    });
  });

  // Initialize MinIO
  await initMinio();

  return app;
}
