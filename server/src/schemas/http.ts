/**
 * HTTP response schemas
 */
import { z } from 'zod';

export const ErrorResponseSchema = z.object({
  error: z.string(),
  code: z.string().optional(),
  details: z.any().optional(),
});

export type ErrorResponse = z.infer<typeof ErrorResponseSchema>;

export const HealthResponseSchema = z.object({
  status: z.enum(['ok', 'error']),
  services: z.object({
    db: z.boolean(),
    redis: z.boolean(),
    minio: z.boolean(),
    vllm: z.object({
      chat: z.boolean(),
      embed: z.boolean(),
      rerank: z.boolean(),
    }),
  }),
  latency: z.record(z.string(), z.number()).optional(),
});

export type HealthResponse = z.infer<typeof HealthResponseSchema>;
