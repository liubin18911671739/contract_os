/**
 * Model configuration
 */
import { env } from './env.js';

export const modelConfig = {
  chat: {
    baseUrl: env.VLLM_CHAT_BASE_URL,
    model: env.RISK_LLM_MODEL,
    apiKey: env.VLLM_API_KEY,
  },
  embed: {
    baseUrl: env.VLLM_EMBED_BASE_URL,
    model: env.EMBED_MODEL,
    apiKey: env.VLLM_API_KEY,
  },
  rerank: {
    baseUrl: env.VLLM_RERANK_BASE_URL,
    model: env.RERANK_MODEL,
    apiKey: env.VLLM_API_KEY,
  },
} as const;

export type ModelType = keyof typeof modelConfig;
