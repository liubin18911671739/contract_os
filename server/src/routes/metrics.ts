/**
 * Metrics routes
 */
import { FastifyInstance } from 'fastify';
import { metricsService } from '../services/metricsService.js';

export async function metricsRoutes(fastify: FastifyInstance) {
  // Get metrics overview for a date range
  fastify.get('/metrics/overview', async (request, reply) => {
    try {
      const { from, to } = request.query as {
        from?: string;
        to?: string;
      };

      // Default to last 30 days if not provided
      const now = new Date();
      const defaultTo = now.toISOString().split('T')[0];
      const defaultFrom = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000)
        .toISOString()
        .split('T')[0];

      const fromDate = from || defaultFrom;
      const toDate = to || defaultTo;

      // Validate date format
      const fromRegex = /^\d{4}-\d{2}-\d{2}$/;
      const toRegex = /^\d{4}-\d{2}-\d{2}$/;

      if (!fromRegex.test(fromDate) || !toRegex.test(toDate)) {
        reply.code(400).send({ error: 'Invalid date format. Use YYYY-MM-DD' });
        return;
      }

      const metrics = await metricsService.getOverview(fromDate, toDate);
      reply.send(metrics);
    } catch (error) {
      reply.code(500).send({ error: 'Failed to fetch metrics overview' });
    }
  });

  // Get F1 score and related metrics
  fastify.get('/metrics/f1-score', async (request, reply) => {
    try {
      const metrics = await metricsService.getF1Score();
      reply.send(metrics);
    } catch (error) {
      reply.code(500).send({ error: 'Failed to fetch F1 score' });
    }
  });

  // Get hallucination rate
  fastify.get('/metrics/hallucination-rate', async (request, reply) => {
    try {
      const metrics = await metricsService.getHallucinationRate();
      reply.send(metrics);
    } catch (error) {
      reply.code(500).send({ error: 'Failed to fetch hallucination rate' });
    }
  });
}
