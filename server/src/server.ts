/**
 * Server entry point
 */
import { buildApp } from './app.js';
import { logger } from './config/logger.js';
import { env } from './config/env.js';
import { orchestratorWorker } from './workers/orchestrator.worker.js';
import { parseWorker } from './workers/agents/parse.worker.js';
import { splitWorker } from './workers/agents/split.worker.js';
import { llmRiskWorker } from './workers/agents/llmRisk.worker.js';
import { kbRetrievalWorker } from './workers/agents/kbRetrieval.worker.js';
import { reportWorker } from './workers/agents/report.worker.js';
import {
  rulesWorker,
  evidenceWorker,
  qcWorker,
} from './workers/agents/stubWorkers.js';
import { ingestWorker, indexWorker } from './workers/kb/kbWorkers.js';

async function main() {
  logger.info('Starting Contract Pre-check Server...');

  const app = await buildApp();

  try {
    await app.listen({ port: env.SERVER_PORT, host: env.SERVER_HOST });
    logger.info(`Server listening on http://${env.SERVER_HOST}:${env.SERVER_PORT}`);

    // Graceful shutdown
    const shutdown = async () => {
      logger.info('Shutting down...');
      await app.close();
      await orchestratorWorker.close();
      await parseWorker.close();
      await splitWorker.close();
      await llmRiskWorker.close();
      await rulesWorker.close();
      await kbRetrievalWorker.close();
      await evidenceWorker.close();
      await qcWorker.close();
      await reportWorker.close();
      await ingestWorker.close();
      await indexWorker.close();
      process.exit(0);
    };

    process.on('SIGTERM', shutdown);
    process.on('SIGINT', shutdown);
  } catch (error) {
    logger.error({ error }, 'Failed to start server');
    process.exit(1);
  }
}

main();
