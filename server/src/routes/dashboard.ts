/**
 * Dashboard routes
 */
import { FastifyInstance } from 'fastify';
import { dashboardService } from '../services/dashboardService.js';

export async function dashboardRoutes(fastify: FastifyInstance) {
  // Get dashboard statistics
  fastify.get('/dashboard/stats', async (request, reply) => {
    try {
      const stats = await dashboardService.getStats();
      reply.send(stats);
    } catch (error) {
      reply.code(500).send({ error: 'Failed to fetch dashboard stats' });
    }
  });

  // Get recent tasks with pagination
  fastify.get('/dashboard/recent-tasks', async (request, reply) => {
    try {
      const { page = '1', limit = '10' } = request.query as {
        page?: string;
        limit?: string;
      };

      const pageNum = Math.max(1, parseInt(page, 10));
      const limitNum = Math.min(50, Math.max(1, parseInt(limit, 10))); // Max 50 items

      const result = await dashboardService.getRecentTasks(pageNum, limitNum);
      reply.send(result);
    } catch (error) {
      reply.code(500).send({ error: 'Failed to fetch recent tasks' });
    }
  });
}
