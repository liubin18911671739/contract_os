/**
 * Task service
 */
import { sql } from '../config/db.js';
import { generateId } from '../utils/hash.js';
import type { PrecheckTask } from '../schemas/task.js';

export interface CreateTaskParams {
  contractVersionId: string;
  kbCollectionIds: string[];
  kbMode: 'STRICT' | 'RELAXED';
  templateId?: string;
}

export class TaskService {
  async createTask(params: CreateTaskParams): Promise<string> {
    const taskId = generateId('task');

    // Create config snapshot
    const snapshotId = generateId('snap');
    await sql`
      INSERT INTO config_snapshots (id, ruleset_version, model_config_json, prompt_template_version, kb_collection_versions_json)
      VALUES (
        ${snapshotId},
        'v1.0',
        ${JSON.stringify({
          chatModel: process.env.RISK_LLM_MODEL,
          embedModel: process.env.EMBED_MODEL,
          rerankModel: process.env.RERANK_MODEL,
        })},
        'v1.0',
        ${JSON.stringify(params.kbCollectionIds)}
      )
    `;

    // Create task
    await sql`
      INSERT INTO precheck_tasks (id, contract_version_id, status, progress, current_stage, config_snapshot_id, kb_mode)
      VALUES (${taskId}, ${params.contractVersionId}, 'QUEUED', 0, 'QUEUED', ${snapshotId}, ${params.kbMode})
    `;

    // Create KB snapshots
    for (const collectionId of params.kbCollectionIds) {
      const [collection] = await sql`
        SELECT version FROM kb_collections WHERE id = ${collectionId}
      `;

      if (collection) {
        await sql`
          INSERT INTO task_kb_snapshots (id, task_id, collection_id, collection_version)
          VALUES (${generateId('snap')}, ${taskId}, ${collectionId}, ${collection.version})
        `;
      }
    }

    return taskId;
  }

  async getTask(taskId: string): Promise<PrecheckTask | null> {
    const [task] = await sql<any[]>`
      SELECT
        id,
        contract_version_id,
        status,
        progress,
        current_stage,
        cancel_requested,
        kb_mode,
        error_message,
        created_at,
        updated_at
      FROM precheck_tasks
      WHERE id = ${taskId}
    `;

    if (!task) return null;

    return {
      id: task.id,
      contract_version_id: task.contract_version_id,
      status: task.status,
      progress: task.progress,
      current_stage: task.current_stage,
      cancel_requested: task.cancel_requested,
      kb_mode: task.kb_mode,
      error_message: task.error_message,
      created_at: task.created_at.toISOString(),
      updated_at: task.updated_at.toISOString(),
    };
  }

  async updateTaskStatus(
    taskId: string,
    updates: {
      status?: string;
      progress?: number;
      currentStage?: string;
      errorMessage?: string;
    }
  ): Promise<void> {
    // Build dynamic SET clause using parameters
    const setClauses: string[] = [];
    const params: any[] = [];
    let paramIndex = 1;

    if (updates.status !== undefined) {
      setClauses.push(`status = $${paramIndex++}`);
      params.push(updates.status);
    }
    if (updates.progress !== undefined) {
      setClauses.push(`progress = $${paramIndex++}`);
      params.push(updates.progress);
    }
    if (updates.currentStage !== undefined) {
      setClauses.push(`current_stage = $${paramIndex++}`);
      params.push(updates.currentStage);
    }
    if (updates.errorMessage !== undefined) {
      setClauses.push(`error_message = $${paramIndex++}`);
      params.push(updates.errorMessage);
    }

    // Always update timestamp
    setClauses.push(`updated_at = CURRENT_TIMESTAMP`);

    // Add taskId as the last parameter
    params.push(taskId);

    // Execute the query
    await sql.unsafe(
      `UPDATE precheck_tasks SET ${setClauses.join(', ')} WHERE id = $${paramIndex}`,
      params
    );
  }

  async setCancelRequested(taskId: string): Promise<void> {
    await sql`
      UPDATE precheck_tasks
      SET cancel_requested = TRUE
      WHERE id = ${taskId}
    `;
  }

  async getTaskEvents(taskId: string) {
    const events = await sql`
      SELECT id, ts, stage, level, message, meta_json
      FROM task_events
      WHERE task_id = ${taskId}
      ORDER BY ts ASC
    `;

    return events.map((e) => ({
      id: e.id,
      ts: e.ts.toISOString(),
      stage: e.stage,
      level: e.level,
      message: e.message,
      meta: e.meta_json,
    }));
  }

  async writeTaskEvent(
    taskId: string,
    stage: string,
    level: 'info' | 'warning' | 'error',
    message: string,
    meta?: Record<string, any>
  ): Promise<void> {
    await sql`
      INSERT INTO task_events (id, task_id, stage, level, message, meta_json)
      VALUES (${generateId('event')}, ${taskId}, ${stage}, ${level}, ${message}, ${meta ? JSON.stringify(meta) : null})
    `;
  }
}

export const taskService = new TaskService();
