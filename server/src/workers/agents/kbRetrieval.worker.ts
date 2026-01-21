/**
 * KB Retrieval agent worker - retrieves relevant KB chunks for each clause
 */
import { createWorker } from '../../queues/index.js';
import { retrievalService } from '../../services/retrievalService.js';
import { BaseAgent } from '../../agents/baseAgent.js';
import { sql } from '../../config/db.js';
import { generateId } from '../../utils/hash.js';
import { logger } from '../../config/logger.js';

class KBRetrievalAgent extends BaseAgent {
  readonly stageName = 'KB_RETRIEVAL';

  protected async execute(jobData: any): Promise<any> {
    const { taskId } = jobData;

    // Get all clauses for this task
    const clauses = await sql`
      SELECT clause_id, text FROM clauses WHERE task_id = ${taskId}
    `;

    // Get KB collections for this task (from snapshot)
    const collections = await sql`
      SELECT collection_id FROM task_kb_snapshots WHERE task_id = ${taskId}
    `;

    const collectionIds = collections.map((c: any) => c.collection_id);

    if (collectionIds.length === 0) {
      logger.warn({ taskId }, 'No KB collections associated with task');
      return { hits: 0 };
    }

    let totalHits = 0;

    // For each clause, perform KB retrieval
    for (const clause of clauses) {
      try {
        // Build query from clause text
        const query = clause.text.substring(0, 1000); // Limit query length

        // Retrieve relevant KB chunks
        const results = await retrievalService.retrieve(query, collectionIds, {
          taskId,
          topK: 20,
          topN: 8,
        });

        // Store results in kb_hits_temp table
        for (const result of results) {
          await sql`
            INSERT INTO kb_hits_temp (id, task_id, clause_id, chunk_id, score, quote_text, doc_title, doc_version)
            VALUES (
              ${generateId('kbhit')},
              ${taskId},
              ${clause.clause_id},
              ${result.chunkId},
              ${result.score},
              ${result.text.substring(0, 500)},
              ${result.docTitle},
              ${result.docVersion}
            )
          `;
        }

        totalHits += results.length;

        logger.debug(
          {
            taskId,
            clauseId: clause.clause_id,
            hits: results.length,
          },
          'KB retrieval completed for clause'
        );
      } catch (error) {
        logger.error(
          {
            taskId,
            clauseId: clause.clause_id,
            error,
          },
          'KB retrieval failed for clause'
        );

        // Continue with other clauses even if one fails
        // Insert empty result to mark retrieval attempted
        await sql`
          INSERT INTO kb_hits_temp (id, task_id, clause_id, chunk_id, score, quote_text, doc_title, doc_version)
          VALUES (
            ${generateId('kbhit')},
            ${taskId},
            ${clause.clause_id},
            ${'retrieval_failed'},
            ${1.0},
            ${'KB retrieval failed: ' + (error instanceof Error ? error.message : 'Unknown error')},
            ${'Error'},
            ${0}
          )
        `;
      }
    }

    logger.info(
      {
        taskId,
        clauses: clauses.length,
        totalHits,
      },
      'KB retrieval completed for all clauses'
    );

    return {
      clauses: clauses.length,
      hits: totalHits,
    };
  }
}

const agent = new KBRetrievalAgent();
export const kbRetrievalWorker = createWorker(
  'precheck.agent.kbRetrieval',
  (job) => agent.run(job.data),
  { concurrency: 2 }
);
