/**
 * Parse agent worker - extracts text from contract files
 */
import { createWorker } from '../../queues/index.js';
import { contractService } from '../../services/contractService.js';
import { fileParser } from '../../utils/fileParser.js';
import { BaseAgent } from '../../agents/baseAgent.js';
import { logger } from '../../config/logger.js';
import { sql } from '../../config/db.js';

class ParseAgent extends BaseAgent {
  readonly stageName = 'PARSING';

  protected async execute(jobData: any): Promise<any> {
    const { taskId } = jobData;

    // Get contract version info
    const [task] = await sql`
      SELECT cv.contract_id, cv.object_key, cv.mime, cv.sha256
      FROM precheck_tasks pt
      JOIN contract_versions cv ON pt.contract_version_id = cv.id
      WHERE pt.id = ${taskId}
    `;

    if (!task) {
      throw new Error('Contract not found');
    }

    // Download file from MinIO
    const file = await contractService.downloadFile(task.object_key);

    // Parse file based on MIME type
    let parseResult;
    try {
      parseResult = await fileParser.parse(file, task.mime, task.object_key);
    } catch (error) {
      logger.error({ taskId, mime: task.mime, error }, 'File parsing failed');
      throw new Error(`Failed to parse file: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }

    const { text, metadata } = parseResult;

    // Validate parsed text
    if (!text || text.trim().length === 0) {
      throw new Error('Parsed text is empty');
    }

    logger.info({
      taskId,
      mime: task.mime,
      textLength: text.length,
      pages: metadata?.pages,
    }, 'File parsed successfully');

    // Store parsed text and metadata for next stage
    return {
      text,
      mime: task.mime,
      metadata: {
        ...metadata,
        sha256: task.sha256,
      },
    };
  }
}

const agent = new ParseAgent();
export const parseWorker = createWorker('precheck.agent.parse', (job) => agent.run(job.data), {
  concurrency: 2,
});
