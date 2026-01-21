/**
 * Report routes
 */
import { FastifyInstance } from 'fastify';
import { reportService } from '../services/reportService.js';

export async function reportRoutes(fastify: FastifyInstance) {
  // Download report
  fastify.get('/reports/:reportId/download', async (request, reply) => {
    const { reportId } = request.params as { reportId: string };

    try {
      const url = await reportService.getReportUrl(reportId);

      // Redirect to presigned MinIO URL
      reply.redirect(url);
    } catch (error) {
      reply.code(404).send({ error: 'Report not found' });
    }
  });

  // Get report info
  fastify.get('/reports/:reportId', async (request, reply) => {
    const { reportId } = request.params as { reportId: string };

    const [report] = await request.server.sql`
      SELECT id, task_id, object_key, template_id, created_at
      FROM reports
      WHERE id = ${reportId}
    `;

    if (!report) {
      reply.code(404).send({ error: 'Report not found' });
      return;
    }

    reply.send(report);
  });

  // List reports for task
  fastify.get('/precheck-tasks/:taskId/reports', async (request, reply) => {
    const { taskId } = request.params as { taskId: string };

    const reports = await request.server.sql`
      SELECT id, object_key, template_id, created_at
      FROM reports
      WHERE task_id = ${taskId}
      ORDER BY created_at DESC
    `;

    reply.send(reports);
  });
}
