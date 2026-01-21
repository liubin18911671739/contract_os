/**
 * Risk analysis prompts
 */
import { truncateText } from '../../utils/promptGuard.js';

export function buildRiskAnalysisPrompt(params: {
  clauseText: string;
  ruleHints: string[];
  kbContexts: Array<{ text: string; docTitle: string }>;
}): string {
  const { clauseText, ruleHints, kbContexts } = params;

  const systemPrompt = `You are a legal contract risk analyzer. Your task is to identify potential risks in contract clauses based on legal rules and knowledge base references.

Analyze the given clause and output ONLY a valid JSON object in the following format:
{
  "risks": [
    {
      "clause_id": "clause identifier",
      "risk_level": "HIGH|MEDIUM|LOW|INFO",
      "risk_type": "risk category (e.g., 'PAYMENT_TERM', 'LIABILITY', 'JURISDICTION')",
      "confidence": 0.0-1.0,
      "summary": "brief risk description",
      "suggestion": "how to fix or mitigate the risk",
      "contract_evidence": {
        "clause_id": "clause identifier",
        "quote_text": "exact text from clause that shows the risk"
      },
      "kb_evidence": [
        {
          "chunk_id": "reference id",
          "quote_text": "supporting text from knowledge base",
          "doc_title": "document title",
          "doc_version": 1
        }
      ]
    }
  ]
}

IMPORTANT:
- Output ONLY valid JSON, no additional text
- If no risks found, return { "risks": [] }
- For each risk, you MUST include at least the contract_evidence with quote_text
- Include kb_evidence entries for relevant knowledge base references
- Risk levels: HIGH (critical legal issue), MEDIUM (significant concern), LOW (minor issue), INFO (informational)`;

  let userPrompt = `## Clause to Analyze\n\n${truncateText(clauseText, 2000)}\n\n`;

  if (ruleHints.length > 0) {
    userPrompt += `## Rule Hints\n\n${ruleHints.map((h, i) => `${i + 1}. ${h}`).join('\n')}\n\n`;
  }

  if (kbContexts.length > 0) {
    userPrompt += `## Knowledge Base References\n\n`;
    kbContexts.forEach((kb, i) => {
      userPrompt += `### Reference ${i + 1}: ${kb.docTitle}\n${truncateText(kb.text, 500)}\n\n`;
    });
  }

  userPrompt += `\nAnalyze the clause and output the JSON risk analysis:`;

  return { systemPrompt, userPrompt };
}

/**
 * Repair prompt for when LLM output fails validation
 */
export function buildRepairPrompt(originalOutput: string, validationError: string): string {
  return `Your previous output was not valid JSON. Fix it and output ONLY valid JSON.

Error: ${validationError}

Your output (fix this):
${originalOutput}

Output ONLY the corrected JSON object, no explanations.`;
}
