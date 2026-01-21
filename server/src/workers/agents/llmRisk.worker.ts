/**
 * LLM Risk agent worker - analyzes risks using local LLM
 */
import { createWorker } from '../../queues/index.js';
import { BaseAgent } from '../../agents/baseAgent.js';
import { modelGateway } from '../../llm/modelGateway.js';
import { buildRiskAnalysisPrompt, buildRepairPrompt } from '../../llm/prompts/risk.js';
import { safeValidateRiskAnalysis } from '../../llm/schemas.js';
import { sql } from '../../config/db.js';
import { generateId } from '../../utils/hash.js';
import { logger } from '../../config/logger.js';

class LLMRiskAgent extends BaseAgent {
  readonly stageName = 'LLM_RISK';

  protected async execute(jobData: any): Promise<any> {
    const { taskId } = jobData;

    // Get clauses with KB hits
    const clauses = await sql`
      SELECT c.id, c.clause_id, c.text
      FROM clauses c
      WHERE c.task_id = ${taskId}
      ORDER BY c.order_no
    `;

    const risksCreated: string[] = [];

    for (const clause of clauses) {
      // Get KB hits for this clause
      const kbHits = await sql`
        SELECT chunk_id, quote_text, doc_title, doc_version
        FROM kb_hits_temp
        WHERE task_id = ${taskId} AND clause_id = ${clause.clause_id}
        ORDER BY score ASC
        LIMIT 6
      `;

      // Build prompt
      const { systemPrompt, userPrompt } = buildRiskAnalysisPrompt({
        clauseText: clause.text,
        ruleHints: [],
        kbContexts: kbHits.map((h: any) => ({ text: h.quote_text, docTitle: h.doc_title })),
      });

      // Call LLM with retry
      let response: string;
      let validated: any;

      try {
        response = await modelGateway.chat(
          [
            { role: 'system', content: systemPrompt },
            { role: 'user', content: userPrompt },
          ],
          { temperature: 0.3, maxTokens: 2048, jsonMode: true }
        );

        validated = safeValidateRiskAnalysis(response);

        // If validation fails, retry with repair prompt
        if (!validated.success) {
          logger.warn({ error: validated.error }, 'LLM output validation failed, retrying');
          const repairPrompt = buildRepairPrompt(response, validated.error || 'Invalid JSON');
          response = await modelGateway.chat(
            [
              { role: 'system', content: systemPrompt },
              { role: 'user', content: repairPrompt },
            ],
            { temperature: 0.1, maxTokens: 2048, jsonMode: true }
          );
          validated = safeValidateRiskAnalysis(response);
        }

        if (!validated.success || !validated.data) {
          throw new Error('Failed to validate LLM output after repair');
        }

        // Save risks
        for (const risk of validated.data.risks) {
          const riskId = generateId('risk');
          await sql`
            INSERT INTO risks (id, task_id, clause_id, risk_level, risk_type, confidence, summary, status)
            VALUES (
              ${riskId},
              ${taskId},
              ${clause.clause_id},
              ${risk.risk_level},
              ${risk.risk_type},
              ${risk.confidence},
              ${risk.summary},
              'NEEDS_REVIEW'
            )
          `;

          // Save KB citations
          for (const kbEvidence of risk.kb_evidence) {
            await sql`
              INSERT INTO kb_citations (id, risk_id, chunk_id, score, quote_text, doc_version)
              VALUES (${generateId('cit')}, ${riskId}, ${kbEvidence.chunk_id}, 0.8, ${kbEvidence.quote_text}, ${kbEvidence.doc_version})
            `;
          }

          risksCreated.push(riskId);
        }
      } catch (error) {
        logger.error({ clauseId: clause.clause_id, error }, 'LLM risk analysis failed');
        // Create NEEDS_REVIEW risk when LLM fails
        const riskId = generateId('risk');
        await sql`
          INSERT INTO risks (id, task_id, clause_id, risk_level, risk_type, confidence, summary, status, qc_flags_json)
          VALUES (
            ${riskId},
            ${taskId},
            ${clause.clause_id},
            'INFO',
            'LLM_ERROR',
            0.0,
            'LLM analysis failed, manual review required',
            'NEEDS_REVIEW',
            ${JSON.stringify({ llm_error: true, error_message: error instanceof Error ? error.message : 'Unknown' })}
          )
        `;
        risksCreated.push(riskId);
      }
    }

    return { riskCount: risksCreated.length };
  }
}

const agent = new LLMRiskAgent();
export const llmRiskWorker = createWorker('precheck.agent.llmRisk', (job) => agent.run(job.data), {
  concurrency: parseInt(process.env.LLM_RISK_CONCURRENCY || '3'),
});
