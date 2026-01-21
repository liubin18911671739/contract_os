/**
 * Task-related schemas
 */
import { z } from 'zod';

export const CreateContractSchema = z.object({
  contract_name: z.string().min(1),
  counterparty: z.string().optional(),
  contract_type: z.string().optional(),
});

export const CreateContractVersionSchema = z.object({
  file: z.any(), // MultipartFile
});

export const CreatePrecheckTaskSchema = z.object({
  contract_version_id: z.string(),
  template_id: z.string().optional(),
  kb_collection_ids: z.array(z.string()).min(1),
  kb_mode: z.enum(['STRICT', 'RELAXED']),
});

export const TaskStatusSchema = z.enum([
  'QUEUED',
  'PARSING',
  'STRUCTURING',
  'RULE_SCORING',
  'KB_RETRIEVAL',
  'LLM_RISK',
  'EVIDENCING',
  'QCING',
  'DONE',
  'FAILED',
  'CANCELLED',
]);

export const TaskEventSchema = z.object({
  id: z.string(),
  ts: z.string().datetime(),
  stage: z.string(),
  level: z.enum(['info', 'warning', 'error']),
  message: z.string(),
  meta: z.any().optional(),
});

export const PrecheckTaskSchema = z.object({
  id: z.string(),
  contract_version_id: z.string(),
  status: TaskStatusSchema,
  progress: z.number().min(0).max(100),
  current_stage: z.string(),
  cancel_requested: z.boolean(),
  kb_mode: z.enum(['STRICT', 'RELAXED']),
  error_message: z.string().optional(),
  created_at: z.string().datetime(),
  updated_at: z.string().datetime(),
});

export const ReviewConclusionSchema = z.enum(['APPROVE', 'MODIFY', 'ESCALATE']);

export const CreateReviewSchema = z.object({
  conclusion: ReviewConclusionSchema,
  notes: z.string().optional(),
});

export type CreateContract = z.infer<typeof CreateContractSchema>;
export type CreatePrecheckTask = z.infer<typeof CreatePrecheckTaskSchema>;
export type PrecheckTask = z.infer<typeof PrecheckTaskSchema>;
export type TaskEvent = z.infer<typeof TaskEventSchema>;
export type CreateReview = z.infer<typeof CreateReviewSchema>;
