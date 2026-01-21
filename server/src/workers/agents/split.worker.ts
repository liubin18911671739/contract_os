/**
 * Split agent worker - splits contract into clauses
 */
import { createWorker } from '../../queues/index.js';
import { BaseAgent, type AgentJobData } from '../../agents/baseAgent.js';
import { sql } from '../../config/db.js';
import { generateId } from '../../utils/hash.js';
import { logger } from '../../config/logger.js';

class SplitAgent extends BaseAgent {
  readonly stageName = 'STRUCTURING';

  protected async execute(jobData: AgentJobData): Promise<{ clauseCount: number }> {
    const { taskId, payload } = jobData;
    const { text } = payload;

    if (!text) {
      throw new Error('No text provided from parse stage');
    }

    // Simple clause splitting by common patterns
    const lines = text.split('\n');
    const clauses: { title: string; text: string; orderNo: number }[] = [];
    let currentClause = { title: '', text: '', orderNo: 0 };

    for (const line of lines) {
      // Check if line looks like a clause header
      const isHeader = /^(\d+\.|\d+\.\d+|[第]\d+[条条款章]|[A-Z][A-Z\s]+$)/.test(line.trim());

      if (isHeader && currentClause.text) {
        clauses.push({ ...currentClause });
        currentClause = { title: line.trim(), text: '', orderNo: clauses.length };
      } else {
        if (isHeader) {
          currentClause.title = line.trim();
          currentClause.orderNo = clauses.length;
        }
        currentClause.text += line + '\n';
      }
    }

    if (currentClause.text) {
      clauses.push(currentClause);
    }

    // Fallback: if no clauses found, split by paragraphs
    if (clauses.length === 0) {
      const paragraphs = text.split('\n\n');
      paragraphs.forEach((para: string, i: number) => {
        if (para.trim()) {
          clauses.push({ title: `Clause ${i + 1}`, text: para.trim(), orderNo: i });
        }
      });
    }

    // Save clauses to database
    for (const clause of clauses) {
      const clauseId = generateId('clause');
      await sql`
        INSERT INTO clauses (id, task_id, clause_id, title, text, order_no)
        VALUES (${generateId('id')}, ${taskId}, ${clauseId}, ${clause.title}, ${clause.text}, ${clause.orderNo})
      `;
    }

    logger.info({ taskId, clauseCount: clauses.length }, 'Clauses extracted');

    return { clauseCount: clauses.length };
  }
}

const agent = new SplitAgent();
export const splitWorker = createWorker('precheck.agent.split', (job) => agent.run(job.data), {
  concurrency: 2,
});
