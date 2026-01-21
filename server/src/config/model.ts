/**
 * Model configuration - supports multiple LLM providers
 */
import { env } from './env.js';

function getModelConfig() {
  const provider = env.LLM_PROVIDER || 'local';

  if (provider === 'zhipu') {
    // Zhipu Qingyan configuration
    if (!env.ZHIPU_API_KEY) {
      throw new Error('ZHIPU_API_KEY is required when LLM_PROVIDER=zhipu');
    }

    return {
      chat: {
        baseUrl: env.ZHIPU_CHAT_BASE_URL || 'https://open.bigmodel.cn/api/paas/v4',
        model: env.ZHIPU_CHAT_MODEL || 'glm-4-flash',
        apiKey: env.ZHIPU_API_KEY,
      },
      embed: {
        baseUrl: env.ZHIPU_EMBED_BASE_URL || 'https://open.bigmodel.cn/api/paas/v4',
        model: env.ZHIPU_EMBED_MODEL || 'embedding-3',
        apiKey: env.ZHIPU_API_KEY,
      },
      rerank: {
        baseUrl: env.ZHIPU_RERANK_BASE_URL || 'https://open.bigmodel.cn/api/paas/v4',
        model: env.ZHIPU_RERANK_MODEL || 'rerank-2',
        apiKey: env.ZHIPU_API_KEY,
      },
    };
  }

  // Local vLLM configuration (default)
  return {
    chat: {
      baseUrl: env.VLLM_CHAT_BASE_URL || 'http://localhost:8000/v1',
      model: env.RISK_LLM_MODEL || 'Qwen/Qwen2.5-7B-Instruct',
      apiKey: env.VLLM_API_KEY || 'token-local',
    },
    embed: {
      baseUrl: env.VLLM_EMBED_BASE_URL || 'http://localhost:8001/v1',
      model: env.EMBED_MODEL || 'BAAI/bge-m3',
      apiKey: env.VLLM_API_KEY || 'token-local',
    },
    rerank: {
      baseUrl: env.VLLM_RERANK_BASE_URL || 'http://localhost:8002/v1',
      model: env.RERANK_MODEL || 'BAAI/bge-reranker-v2-m3',
      apiKey: env.VLLM_API_KEY || 'token-local',
    },
  };
}

export const modelConfig = getModelConfig();

export type ModelType = keyof typeof modelConfig;

// Export provider info for logging
export const llmProvider = env.LLM_PROVIDER || 'local';
