/**
 * JSON schemas for LLM structured outputs
 */
import { z } from 'zod';

// Risk analysis output schema
export const RiskAnalysisSchema = z.object({
  risks: z.array(
    z.object({
      clause_id: z.string(),
      risk_level: z.enum(['HIGH', 'MEDIUM', 'LOW', 'INFO']),
      risk_type: z.string(),
      confidence: z.number().min(0).max(1),
      summary: z.string(),
      suggestion: z.string(),
      contract_evidence: z.object({
        clause_id: z.string(),
        quote_text: z.string(),
        start_offset: z.number().optional(),
        end_offset: z.number().optional(),
      }),
      kb_evidence: z.array(
        z.object({
          chunk_id: z.string(),
          quote_text: z.string(),
          doc_title: z.string(),
          doc_version: z.number(),
        })
      ),
    })
  ),
});

export type RiskAnalysis = z.infer<typeof RiskAnalysisSchema>;

// Report generation schema
export const ReportSchema = z.object({
  title: z.string(),
  summary: z.string(),
  risk_count: z.number(),
  high_risks: z.number(),
  medium_risks: z.number(),
  low_risks: z.number(),
  sections: z.array(
    z.object({
      title: z.string(),
      content: z.string(),
    })
  ),
});

export type Report = z.infer<typeof ReportSchema>;

// Schema validation helpers
export function validateRiskAnalysis(data: unknown): RiskAnalysis {
  return RiskAnalysisSchema.parse(data);
}

export function safeValidateRiskAnalysis(data: unknown): {
  success: boolean;
  data?: RiskAnalysis;
  error?: string;
} {
  try {
    return { success: true, data: RiskAnalysisSchema.parse(data) };
  } catch (error) {
    if (error instanceof z.ZodError) {
      return { success: false, error: error.errors.map((e) => e.message).join(', ') };
    }
    return { success: false, error: 'Unknown validation error' };
  }
}
