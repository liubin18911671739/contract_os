/**
 * Orchestrator Test
 * Tests orchestrator state machine progression
 */
import { describe, it } from 'node:test';
import assert from 'node:assert';
import { sql } from '../config/db.js';
import { taskService } from '../services/taskService.js';

describe('Orchestrator', () => {
  it('should progress through all stages', async () => {
    const taskId = 'test_orchestrator_task';
    const contractVersionId = 'test_contract_version';

    // Setup: Create contract version
    await sql`
      INSERT INTO contract_versions (id, contract_id, version_no, object_key, sha256, mime)
      VALUES (${contractVersionId}, 'contract1', 1, 'key', 'hash', 'text/plain')
    `;

    // Mock config snapshot
    await sql`
      INSERT INTO config_snapshots (id, ruleset_version, model_config_json, prompt_template_version, kb_collection_versions_json)
      VALUES ('snap1', 'v1.0', '{}', 'v1.0', '[]')
    `;

    // Create task
    await sql`
      INSERT INTO precheck_tasks (id, contract_version_id, status, progress, current_stage, config_snapshot_id, kb_mode)
      VALUES (${taskId}, ${contractVersionId}, 'QUEUED', 0, 'QUEUED', 'snap1', 'STRICT')
    `;

    // Simulate orchestrator progression
    const stages = ['PARSING', 'STRUCTURING', 'RULE_SCORING', 'KB_RETRIEVAL', 'LLM_RISK', 'EVIDENCING', 'QCING'];

    for (let i = 0; i < stages.length; i++) {
      const stage = stages[i];
      const progress = Math.floor(((i + 1) / stages.length) * 100);

      await taskService.updateTaskStatus(taskId, {
        currentStage: stage,
        progress,
      });

      await taskService.writeTaskEvent(taskId, stage, 'info', `Stage ${stage} started`);

      // Verify state
      const task = await taskService.getTask(taskId);
      assert.strictEqual(task?.current_stage, stage);
      assert.strictEqual(task?.progress, progress);
    }

    // Complete task
    await taskService.updateTaskStatus(taskId, {
      status: 'DONE',
      progress: 100,
      currentStage: 'DONE',
    });

    // Verify final state
    const finalTask = await taskService.getTask(taskId);
    assert.strictEqual(finalTask?.status, 'DONE');
    assert.strictEqual(finalTask?.progress, 100);

    // Verify events were written
    const events = await taskService.getTaskEvents(taskId);
    assert.strictEqual(events.length, stages.length);

    // Cleanup
    await sql`DELETE FROM task_events WHERE task_id = ${taskId}`;
    await sql`DELETE FROM precheck_tasks WHERE id = ${taskId}`;
    await sql`DELETE FROM config_snapshots WHERE id = 'snap1'`;
    await sql`DELETE FROM contract_versions WHERE id = ${contractVersionId}`;
  });

  it('should handle failures and mark task as FAILED', async () => {
    const taskId = 'test_fail_task';
    const contractVersionId = 'test_fail_contract';

    await sql`
      INSERT INTO contract_versions (id, contract_id, version_no, object_key, sha256, mime)
      VALUES (${contractVersionId}, 'contract2', 1, 'key', 'hash', 'text/plain')
    `;

    await sql`
      INSERT INTO config_snapshots (id, ruleset_version, model_config_json, prompt_template_version, kb_collection_versions_json)
      VALUES ('snap2', 'v1.0', '{}', 'v1.0', '[]')
    `;

    await sql`
      INSERT INTO precheck_tasks (id, contract_version_id, status, progress, current_stage, config_snapshot_id, kb_mode)
      VALUES (${taskId}, ${contractVersionId}, 'QUEUED', 0, 'QUEUED', 'snap2', 'STRICT')
    `;

    // Simulate failure at PARSING stage
    await taskService.updateTaskStatus(taskId, {
      currentStage: 'PARSING',
      progress: 10,
    });

    await taskService.writeTaskEvent(taskId, 'PARSING', 'error', 'Parsing failed');

    await taskService.updateTaskStatus(taskId, {
      status: 'FAILED',
      errorMessage: 'Parsing failed: Invalid file format',
    });

    // Verify failed state
    const task = await taskService.getTask(taskId);
    assert.strictEqual(task?.status, 'FAILED');
    assert.strictEqual(task?.error_message?.includes('Parsing failed'), true);

    // Cleanup
    await sql`DELETE FROM task_events WHERE task_id = ${taskId}`;
    await sql`DELETE FROM precheck_tasks WHERE id = ${taskId}`;
    await sql`DELETE FROM config_snapshots WHERE id = 'snap2'`;
    await sql`DELETE FROM contract_versions WHERE id = ${contractVersionId}`;
  });
});
