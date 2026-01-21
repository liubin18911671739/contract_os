/**
 * Stub workers for remaining agents (excluding KB Retrieval - now in separate file)
 * These are simplified implementations for PoC
 */
import { createWorker } from '../../queues/index.js';
import { BaseAgent } from '../../agents/baseAgent.js';
import { sql } from '../../config/db.js';
import { logger } from '../../config/logger.js';

// Rules Agent
class RulesAgent extends BaseAgent {
  readonly stageName = 'RULE_SCORING';

  protected async execute(jobData: any): Promise<any> {
    const { taskId } = jobData;
    // Simple keyword-based rules
    const clauses = await sql`
      SELECT id, text FROM clauses WHERE task_id = ${taskId}
    `;

    let ruleHits = 0;
    for (const clause of clauses) {
      const text = clause.text.toLowerCase();
      // Add rule hints based on keywords
      if (text.includes('支付') || text.includes('payment')) {
        ruleHits++;
      }
    }

    return { ruleHits };
  }
}

// Evidence Agent
class EvidenceAgent extends BaseAgent {
  readonly stageName = 'EVIDENCING';

  protected async execute(jobData: any): Promise<any> {
    const { taskId } = jobData;

    // Evidence is already created by LLM Risk agent
    // This agent consolidates and verifies evidence

    // Get all risks with their KB citations
    const risks = await sql`
      SELECT r.id, r.clause_id, COUNT(kc.id) as citation_count
      FROM risks r
      LEFT JOIN kb_citations kc ON kc.risk_id = r.id
      WHERE r.task_id = ${taskId}
      GROUP BY r.id, r.clause_id
    `;

    let evidenceCount = 0;
    for (const risk of risks) {
      if (risk.citation_count > 0) {
        evidenceCount++;
      }
    }

    logger.info({
      taskId,
      totalRisks: risks.length,
      risksWithEvidence: evidenceCount,
    }, 'Evidence consolidation completed');

    return {
      totalRisks: risks.length,
      risksWithEvidence: evidenceCount,
    };
  }
}

// QC Agent
class QCAgent extends BaseAgent {
  readonly stageName = 'QCING';

  protected async execute(jobData: any): Promise<any> {
    const { taskId } = jobData;

    // Verify KB citations exist and match snapshot versions
    const risks = await sql`
      SELECT id, risk_level FROM risks WHERE task_id = ${taskId}
    `;

    let hallucinationCount = 0;
    let risksChecked = 0;

    for (const risk of risks) {
      risksChecked++;

      // Check if chunk exists in kb_chunks
      const citations = await sql`
        SELECT chunk_id FROM kb_citations WHERE risk_id = ${risk.id}
      `;

      let hallucinationSuspect = false;

      for (const cit of citations) {
        const [chunk] = await sql`
          SELECT c.id, d.version as doc_version, tks.collection_version as snapshot_version
          FROM kb_chunks c
          JOIN kb_documents d ON c.document_id = d.id
          LEFT JOIN task_kb_snapshots tks ON tks.task_id = ${taskId} AND tks.collection_id = d.collection_id
          WHERE c.id = ${cit.chunk_id}
        `;

        if (!chunk) {
          // Chunk doesn't exist
          hallucinationSuspect = true;
          break;
        }

        // If task has snapshot, check version match
        if (chunk.snapshot_version && chunk.doc_version !== chunk.snapshot_version) {
          hallucinationSuspect = true;
          break;
        }
      }

      if (hallucinationSuspect) {
        await sql`
          UPDATE risks
          SET qc_flags_json = COALESCE(qc_flags_json, '{}'::jsonb) || ${JSON.stringify({ hallucination_suspect: true })}
          WHERE id = ${risk.id}
        `;
        hallucinationCount++;
      }

      // HIGH risk without evidence should be downgraded
      if (risk.risk_level === 'HIGH' && citations.length === 0) {
        await sql`
          UPDATE risks
          SET
            risk_level = 'MEDIUM',
            qc_flags_json = COALESCE(qc_flags_json, '{}'::jsonb) || ${JSON.stringify({ downgraded: 'no_evidence' })}
          WHERE id = ${risk.id}
        `;
      }
    }

    logger.info({
      taskId,
      risksChecked,
      hallucinationCount,
    }, 'QC completed');

    return {
      risksChecked,
      hallucinationCount,
    };
  }
}

// Report Agent - now in separate file (report.worker.ts)
// Removed from here, imported from report.worker.ts instead

// Create workers
const rulesAgent = new RulesAgent();
const evidenceAgent = new EvidenceAgent();
const qcAgent = new QCAgent();

export const rulesWorker = createWorker('precheck.agent.rules', (job) => rulesAgent.run(job.data), {
  concurrency: 2,
});

export const evidenceWorker = createWorker('precheck.agent.evidence', (job) => evidenceAgent.run(job.data), {
  concurrency: parseInt(process.env.EVIDENCE_CONCURRENCY || '3'),
});

export const qcWorker = createWorker('precheck.agent.qc', (job) => qcAgent.run(job.data), {
  concurrency: 2,
});
