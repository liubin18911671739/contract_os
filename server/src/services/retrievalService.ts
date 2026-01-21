/**
 * Retrieval service for KB search with reranking
 */
import { modelGateway } from '../llm/modelGateway.js';
import { kbService } from './kbService.js';
import { logger } from '../config/logger.js';
import { env } from '../config/env.js';

export interface RetrievalResult {
  chunkId: string;
  text: string;
  score: number;
  docTitle: string;
  docVersion: number;
}

export class RetrievalService {
  async retrieve(
    query: string,
    collectionIds: string[],
    options: {
      topK?: number;
      topN?: number;
      taskId?: string;
    } = {}
  ): Promise<RetrievalResult[]> {
    const { topK = env.KB_TOP_K, topN = env.KB_TOP_N, taskId } = options;

    // Step 1: Vector search (topK)
    const vectorResults = await kbService.search(query, collectionIds, topK, taskId);

    if (vectorResults.length === 0) {
      return [];
    }

    // Step 2: Rerank if configured
    if (topN < topK && topN > 0) {
      try {
        const rerankResults = await modelGateway.rerank({
          query,
          documents: vectorResults.map((r) => ({
            id: r.chunkId,
            text: r.text,
          })),
          top_n: topN,
        });

        return rerankResults.map((r) => {
          const original = vectorResults.find((v) => v.chunkId === r.document.id);
          return {
            chunkId: r.document.id,
            text: r.document.text,
            score: r.relevance_score,
            docTitle: original?.docTitle || '',
            docVersion: original?.docVersion || 1,
          };
        });
      } catch (error) {
        logger.warn({ error }, 'Reranking failed, using vector results');
        return vectorResults.slice(0, topN);
      }
    }

    return vectorResults;
  }

  async retrieveForClause(
    clauseText: string,
    ruleHints: string[],
    collectionIds: string[],
    taskId?: string
  ): Promise<RetrievalResult[]> {
    // Build query from clause + rule hints
    const queryParts = [clauseText];
    if (ruleHints.length > 0) {
      queryParts.push(...ruleHints.slice(0, 3)); // Limit hints
    }
    const query = queryParts.join('\n\n').substring(0, 1000);

    return this.retrieve(query, collectionIds, { taskId });
  }
}

export const retrievalService = new RetrievalService();
