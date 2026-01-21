/**
 * Queue connection and registration
 */
import { Queue, Worker } from 'bullmq';
import { redis } from '../config/redis.js';
import { logger } from '../config/logger.js';

// Type assertion to fix ioredis version mismatch between app and bullmq
const redisConnection = redis as any;

export type QueueJobData = any;
export type QueueJobResult = any;

// Create queues
export const orchestratorQueue = new Queue('precheck.orchestrator', {
  connection: redisConnection,
  defaultJobOptions: {
    attempts: 1,
    backoff: {
      type: 'exponential',
      delay: 1000,
    },
  },
});

export const parseQueue = new Queue('precheck.agent.parse', { connection: redisConnection });
export const splitQueue = new Queue('precheck.agent.split', { connection: redisConnection });
export const rulesQueue = new Queue('precheck.agent.rules', { connection: redisConnection });
export const kbRetrievalQueue = new Queue('precheck.agent.kbRetrieval', { connection: redisConnection });
export const llmRiskQueue = new Queue('precheck.agent.llmRisk', { connection: redisConnection });
export const evidenceQueue = new Queue('precheck.agent.evidence', { connection: redisConnection });
export const qcQueue = new Queue('precheck.agent.qc', { connection: redisConnection });
export const reportQueue = new Queue('precheck.agent.report', { connection: redisConnection });

export const kbIngestQueue = new Queue('kb.ingest', { connection: redisConnection });
export const kbIndexQueue = new Queue('kb.index', { connection: redisConnection });

export const queues = {
  orchestrator: orchestratorQueue,
  parse: parseQueue,
  split: splitQueue,
  rules: rulesQueue,
  kbRetrieval: kbRetrievalQueue,
  llmRisk: llmRiskQueue,
  evidence: evidenceQueue,
  qc: qcQueue,
  report: reportQueue,
  kbIngest: kbIngestQueue,
  kbIndex: kbIndexQueue,
};

// Graceful shutdown
export async function closeQueues(): Promise<void> {
  await Promise.all(Object.values(queues).map((q) => q.close()));
}

// Worker wrapper
export function createWorker<T = any, R = any>(
  name: string,
  processor: (job: { data: T }) => Promise<R>,
  options: { concurrency: number }
): Worker {
  const worker = new Worker<T, R>(name, processor, {
    connection: redisConnection,
    concurrency: options.concurrency,
  });

  worker.on('completed', (job) => {
    logger.debug({ job: job.name, id: job.id }, 'Job completed');
  });

  worker.on('failed', (job, error) => {
    logger.error({ job: job?.name, id: job?.id, error }, 'Job failed');
  });

  return worker;
}
