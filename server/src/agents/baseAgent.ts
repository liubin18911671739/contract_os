/**
 * Base agent with common functionality
 */
import { sql } from '../config/db.js';
import { taskService } from '../services/taskService.js';
import { logger } from '../config/logger.js';
import { now } from '../utils/time.js';

export interface AgentJobData {
  taskId: string;
  traceId: string;
  stage: string;
  payload: any;
}

export interface AgentResult {
  ok: boolean;
  taskId: string;
  traceId: string;
  stage: string;
  metrics: {
    elapsedMs: number;
  };
  result?: any;
  error?: {
    code: string;
    message: string;
    retryable: boolean;
  };
}

export abstract class BaseAgent {
  abstract readonly stageName: string;

  /**
   * Main agent logic - to be implemented by subclasses
   */
  protected abstract execute(jobData: AgentJobData): Promise<any>;

  /**
   * Agent entry point
   */
  async run(jobData: AgentJobData): Promise<AgentResult> {
    const startTime = now();
    const { taskId, traceId, stage } = jobData;

    try {
      // Check if task is cancelled
      const task = await taskService.getTask(taskId);
      if (!task) {
        throw new Error('Task not found');
      }
      if (task.cancel_requested) {
        return {
          ok: false,
          taskId,
          traceId,
          stage,
          metrics: { elapsedMs: now() - startTime },
          error: {
            code: 'CANCELLED',
            message: 'Task was cancelled',
            retryable: false,
          },
        };
      }

      // Write start event
      await taskService.writeTaskEvent(taskId, stage, 'info', `Starting ${stage}`);

      // Execute agent logic
      const result = await this.execute(jobData);

      // Write success event
      await taskService.writeTaskEvent(taskId, stage, 'info', `Completed ${stage}`, {
        elapsedMs: now() - startTime,
      });

      return {
        ok: true,
        taskId,
        traceId,
        stage,
        metrics: { elapsedMs: now() - startTime },
        result,
      };
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Unknown error';
      logger.error({ taskId, stage, error }, 'Agent failed');

      // Write error event
      await taskService.writeTaskEvent(taskId, stage, 'error', `Failed ${stage}: ${message}`);

      return {
        ok: false,
        taskId,
        traceId,
        stage,
        metrics: { elapsedMs: now() - startTime },
        error: {
          code: 'AGENT_ERROR',
          message,
          retryable: true,
        },
      };
    }
  }

  /**
   * Helper to get clause text by ID
   */
  protected async getClauseText(taskId: string, clauseId: string): Promise<string | null> {
    const [clause] = await sql`
      SELECT text FROM clauses WHERE task_id = ${taskId} AND clause_id = ${clauseId}
    `;
    return clause?.text || null;
  }
}
