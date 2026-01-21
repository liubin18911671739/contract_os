/**
 * Task routes
 */
import { FastifyInstance } from 'fastify';
import { taskService } from '../services/taskService.js';
import { queues } from '../queues/index.js';
import { sql } from '../config/db.js';
import { CreatePrecheckTaskSchema } from '../schemas/task.js';

export async function taskRoutes(fastify: FastifyInstance) {
  // Create task
  fastify.post('/precheck-tasks', async (request, reply) => {
    const data = CreatePrecheckTaskSchema.parse(request.body);

    const taskId = await taskService.createTask({
      contractVersionId: data.contract_version_id,
      kbCollectionIds: data.kb_collection_ids,
      kbMode: data.kb_mode,
      templateId: data.template_id,
    });

    // Add to orchestrator queue
    await queues.orchestrator.add(
      'orchestrate',
      {
        taskId,
        traceId: taskId,
        stage: 'QUEUED',
        payload: {},
      },
      {
        jobId: taskId,
      }
    );

    reply.code(201).send({ id: taskId });
  });

  // Get task
  fastify.get('/precheck-tasks/:id', async (request, reply) => {
    const { id } = request.params as { id: string };
    const task = await taskService.getTask(id);

    if (!task) {
      reply.code(404).send({ error: 'Task not found' });
      return;
    }

    reply.send(task);
  });

  // Get task events
  fastify.get('/precheck-tasks/:id/events', async (request, reply) => {
    const { id } = request.params as { id: string };
    const events = await taskService.getTaskEvents(id);
    reply.send(events);
  });

  // Cancel task
  fastify.post('/precheck-tasks/:id/cancel', async (request, reply) => {
    const { id } = request.params as { id: string };
    await taskService.setCancelRequested(id);
    reply.send({ success: true });
  });

  // Get task summary
  fastify.get('/precheck-tasks/:id/summary', async (request, reply) => {
    const { id } = request.params as { id: string };

    const [summary] = await sql`
      SELECT
        COUNT(DISTINCT c.id) as clause_count,
        COUNT(r.id) FILTER (WHERE r.risk_level = 'HIGH') as high_risks,
        COUNT(r.id) FILTER (WHERE r.risk_level = 'MEDIUM') as medium_risks,
        COUNT(r.id) FILTER (WHERE r.risk_level = 'LOW') as low_risks,
        COUNT(r.id) FILTER (WHERE r.risk_level = 'INFO') as info_risks
      FROM precheck_tasks pt
      LEFT JOIN clauses c ON c.task_id = pt.id
      LEFT JOIN risks r ON r.task_id = pt.id
      WHERE pt.id = ${id}
      GROUP BY pt.id
    `;

    reply.send(
      summary || { clause_count: 0, high_risks: 0, medium_risks: 0, low_risks: 0, info_risks: 0 }
    );
  });

  // Get task clauses with risks
  fastify.get('/precheck-tasks/:id/clauses', async (request, reply) => {
    const { id } = request.params as { id: string };
    const { risk_level, q } = request.query as any;

    let query = sql`
      SELECT c.*, r.id as risk_id, r.risk_level, r.summary, r.status
      FROM clauses c
      LEFT JOIN risks r ON r.clause_id = c.clause_id AND r.task_id = c.task_id
      WHERE c.task_id = ${id}
    `;

    if (risk_level) {
      query = sql`${query} AND r.risk_level = ${risk_level}`;
    }

    if (q) {
      query = sql`${query} AND (c.text ILIKE ${'%' + q + '%'} OR c.title ILIKE ${'%' + q + '%'})`;
    }

    const clauses = await query;
    reply.send(clauses);
  });

  // Set task conclusion
  fastify.post('/precheck-tasks/:id/conclusion', async (request, reply) => {
    const { id } = request.params as { id: string };
    const { conclusion, notes } = request.body as any;

    await sql`
      INSERT INTO reviews (id, task_id, conclusion, notes, created_by)
      VALUES (${`review_${Date.now()}`}, ${id}, ${conclusion}, ${notes || null}, 'user')
    `;

    reply.send({ success: true });
  });

  // Generate report
  fastify.post('/precheck-tasks/:id/report', async (request, reply) => {
    const { id } = request.params as { id: string };
    const { format = 'html' } = request.body as any;

    const { reportService } = await import('../services/reportService.js');

    const report = await reportService.createReport(id, format);
    reply.code(201).send(report);
  });
}
