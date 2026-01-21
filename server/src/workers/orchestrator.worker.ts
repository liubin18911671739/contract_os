/**
 * Orchestrator worker - manages task state machine
 */
import { queues, createWorker } from '../queues/index.js';
import { taskService } from '../services/taskService.js';
import { generateId } from '../utils/hash.js';
import { logger } from '../config/logger.js';
import type { AgentJobData, AgentResult } from '../agents/baseAgent.js';

const STAGES = [
  'PARSING',
  'STRUCTURING',
  'RULE_SCORING',
  'KB_RETRIEVAL',
  'LLM_RISK',
  'EVIDENCING',
  'QCING',
] as const;

interface OrchestratorState {
  currentStageIndex: number;
  retries: Map<string, number>;
}

const state = new Map<string, OrchestratorState>();

async function processOrchestrator(job: { data: AgentJobData }): Promise<AgentResult> {
  const { taskId, traceId } = job.data;
  const startTime = Date.now();

  logger.info({ taskId, traceId }, 'Orchestrator started');

  // Initialize state
  if (!state.has(taskId)) {
    state.set(taskId, {
      currentStageIndex: 0,
      retries: new Map(),
    });
  }

  const orchestratorState = state.get(taskId)!;
  let completed = false;
  let failed = false;

  try {
    // Process stages sequentially
    while (orchestratorState.currentStageIndex < STAGES.length) {
      const stage = STAGES[orchestratorState.currentStageIndex];

      // Check cancellation
      const task = await taskService.getTask(taskId);
      if (task?.cancel_requested) {
        await taskService.updateTaskStatus(taskId, {
          status: 'CANCELLED',
          progress: task.progress,
        });
        return {
          ok: false,
          taskId,
          traceId,
          stage: 'ORCHESTRATOR',
          metrics: { elapsedMs: Date.now() - startTime },
          error: {
            code: 'CANCELLED',
            message: 'Task was cancelled',
            retryable: false,
          },
        };
      }

      // Update task status
      await taskService.updateTaskStatus(taskId, {
        currentStage: stage,
        progress: Math.floor((orchestratorState.currentStageIndex / STAGES.length) * 100),
      });

      // Add job to appropriate queue
      const queueName = `precheck.agent.${stage.toLowerCase()}` as keyof typeof queues;
      const queue = queues[queueName];

      if (!queue) {
        throw new Error(`Queue not found: ${queueName}`);
      }

      const stageJob = await queue.add(
        stage,
        {
          taskId,
          traceId: generateId('trace'),
          stage,
          payload: {},
        },
        {
          timeout: 5 * 60 * 1000, // 5 minutes per stage
        }
      );

      // Wait for completion
      const result = await stageJob.waitUntilFinished();
      const agentResult = result as AgentResult;

      if (!agentResult.ok) {
        // Check if retryable
        if (agentResult.error?.retryable !== false) {
          const retryCount = orchestratorState.retries.get(stage) || 0;
          if (retryCount < 1) {
            orchestratorState.retries.set(stage, retryCount + 1);
            logger.info({ taskId, stage, retryCount: retryCount + 1 }, 'Retrying stage');
            continue; // Retry same stage
          }
        }

        // Non-retryable or max retries exceeded
        logger.error({ taskId, stage, error: agentResult.error }, 'Stage failed');
        await taskService.updateTaskStatus(taskId, {
          status: 'FAILED',
          errorMessage: agentResult.error?.message,
        });
        failed = true;
        break;
      }

      // Stage completed, move to next
      orchestratorState.currentStageIndex++;
      orchestratorState.retries.delete(stage);
    }

    // All stages completed
    if (!failed) {
      await taskService.updateTaskStatus(taskId, {
        status: 'DONE',
        progress: 100,
        currentStage: 'DONE',
      });
      completed = true;
    }

    return {
      ok: !failed,
      taskId,
      traceId,
      stage: 'ORCHESTRATOR',
      metrics: { elapsedMs: Date.now() - startTime },
      result: { completed },
    };
  } catch (error) {
    logger.error({ taskId, error }, 'Orchestrator error');
    await taskService.updateTaskStatus(taskId, {
      status: 'FAILED',
      errorMessage: error instanceof Error ? error.message : 'Unknown error',
    });

    return {
      ok: false,
      taskId,
      traceId,
      stage: 'ORCHESTRATOR',
      metrics: { elapsedMs: Date.now() - startTime },
      error: {
        code: 'ORCHESTRATOR_ERROR',
        message: error instanceof Error ? error.message : 'Unknown error',
        retryable: false,
      },
    };
  } finally {
    state.delete(taskId);
  }
}

// Create and export worker
export const orchestratorWorker = createWorker('precheck.orchestrator', processOrchestrator, {
  concurrency: parseInt(process.env.ORCHESTRATOR_CONCURRENCY || '1'),
});
