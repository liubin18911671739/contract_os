/**
 * Environment configuration with validation
 */
import { config } from 'dotenv';
import { z } from 'zod';

// Load .env file from parent directory (project root)
config({ path: '../.env' });

const envSchema = z.object({
  // Database
  DATABASE_URL: z.string().url(),

  // Redis
  REDIS_URL: z.string(),

  // MinIO
  MINIO_ENDPOINT: z.string(),
  MINIO_PORT: z.string().transform(Number),
  MINIO_ACCESS_KEY: z.string(),
  MINIO_SECRET_KEY: z.string(),
  MINIO_BUCKET: z.string(),
  MINIO_USE_SSL: z.string().transform((v) => v === 'true'),

  // LLM Provider
  LLM_PROVIDER: z.enum(['local', 'zhipu']).default('local'),

  // vLLM (local provider)
  VLLM_API_KEY: z.string().default('token-local'),
  VLLM_CHAT_BASE_URL: z.string().url().optional(),
  VLLM_EMBED_BASE_URL: z.string().url().optional(),
  VLLM_RERANK_BASE_URL: z.string().url().optional(),

  // Zhipu Qingyan (zhipu provider)
  ZHIPU_API_KEY: z.string().optional(),
  ZHIPU_CHAT_BASE_URL: z.string().url().optional(),
  ZHIPU_EMBED_BASE_URL: z.string().url().optional(),
  ZHIPU_RERANK_BASE_URL: z.string().url().optional(),

  // Models (local vLLM)
  RISK_LLM_MODEL: z.string().default('Qwen/Qwen2.5-7B-Instruct'),
  EMBED_MODEL: z.string().default('BAAI/bge-m3'),
  RERANK_MODEL: z.string().default('BAAI/bge-reranker-v2-m3'),

  // Models (Zhipu Qingyan)
  ZHIPU_CHAT_MODEL: z.string().default('glm-4-flash'),
  ZHIPU_EMBED_MODEL: z.string().default('embedding-3'),
  ZHIPU_RERANK_MODEL: z.string().default('rerank-2'),

  // Server
  SERVER_PORT: z.string().transform(Number).default('3000'),
  SERVER_HOST: z.string().default('0.0.0.0'),
  LOG_LEVEL: z.enum(['fatal', 'error', 'warn', 'info', 'debug', 'trace']).default('info'),

  // Queue
  QUEUE_PREFIX: z.string().default('precheck'),
  ORCHESTRATOR_CONCURRENCY: z.string().transform(Number).default('1'),
  LLM_RISK_CONCURRENCY: z.string().transform(Number).default('3'),
  EVIDENCE_CONCURRENCY: z.string().transform(Number).default('3'),
  KB_INDEX_CONCURRENCY: z.string().transform(Number).default('2'),

  // KB
  KB_CHUNK_SIZE: z.string().transform(Number).default('1000'),
  KB_CHUNK_OVERLAP: z.string().transform(Number).default('200'),
  KB_TOP_K: z.string().transform(Number).default('20'),
  KB_TOP_N: z.string().transform(Number).default('6'),
});

export type Env = z.infer<typeof envSchema>;

function loadEnv(): Env {
  const result = envSchema.safeParse(process.env);

  if (!result.success) {
    console.error('❌ Invalid environment configuration:');
    result.error.errors.forEach((err) => {
      console.error(`  - ${err.path.join('.')}: ${err.message}`);
    });
    process.exit(1);
  }

  return result.data;
}

export const env = loadEnv();
