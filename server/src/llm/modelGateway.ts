/**
 * Model Gateway - Unified client for multiple LLM providers (vLLM, Zhipu)
 */
import { modelConfig, llmProvider } from '../config/model.js';
import { retry } from '../utils/retry.js';
import { logger } from '../config/logger.js';

interface ChatMessage {
  role: 'system' | 'user' | 'assistant';
  content: string;
}

interface ChatResponse {
  choices: Array<{
    message: {
      content: string;
      role: string;
    };
    finish_reason: string;
  }>;
  usage?: {
    prompt_tokens: number;
    completion_tokens: number;
    total_tokens: number;
  };
}

interface ZhipuChatResponse {
  choices: Array<{
    message: {
      content: string;
      role: string;
    };
    finish_reason: string;
  }>;
  usage?: {
    prompt_tokens: number;
    completion_tokens: number;
    total_tokens: number;
  };
}

interface EmbedResponse {
  data: Array<{
    embedding: number[];
    index: number;
  }>;
  usage?: {
    total_tokens: number;
  };
}

interface ZhipuEmbedResponse {
  data: Array<{
    embedding: number[];
    index: number;
  }>;
  usage?: {
    total_tokens: number;
  };
}

interface RerankRequest {
  query: string;
  documents: Array<{
    id: string;
    text: string;
  }>;
  top_n?: number;
}

interface RerankResponse {
  results: Array<{
    index: number;
    document: {
      id: string;
      text: string;
    };
    relevance_score: number;
  }>;
}

interface ZhipuRerankResponse {
  results: Array<{
    index: number;
    relevance_score: number;
    document?: {
      text: string;
    };
  }>;
}

export class ModelGateway {
  private headers: Record<string, string>;
  private provider: string;

  constructor() {
    this.provider = llmProvider;

    // Zhipu uses different authorization format
    if (this.provider === 'zhipu') {
      // Zhipu API Key format: id.secret
      const apiKey = modelConfig.chat.apiKey;
      this.headers = {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${apiKey}`,
      };
    } else {
      // OpenAI-compatible format (vLLM)
      this.headers = {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${modelConfig.chat.apiKey}`,
      };
    }

    logger.info({ provider: this.provider }, 'ModelGateway initialized');
  }

  /**
   * Chat completion
   */
  async chat(
    messages: ChatMessage[],
    options: {
      temperature?: number;
      maxTokens?: number;
      jsonMode?: boolean;
    } = {}
  ): Promise<string> {
    const { temperature = 0.7, maxTokens = 2048, jsonMode = false } = options;

    return retry(
      async () => {
        let url: string;
        let body: any;

        if (this.provider === 'zhipu') {
          // Zhipu API format
          url = `${modelConfig.chat.baseUrl}/chat/completions`;
          body = {
            model: modelConfig.chat.model,
            messages,
            temperature,
            max_tokens: maxTokens,
            ...(jsonMode && { response_format: { type: 'json_object' } }),
          };
        } else {
          // OpenAI-compatible format (vLLM)
          url = `${modelConfig.chat.baseUrl}/chat/completions`;
          body = {
            model: modelConfig.chat.model,
            messages,
            temperature,
            max_tokens: maxTokens,
            ...(jsonMode && { response_format: { type: 'json_object' } }),
          };
        }

        const response = await fetch(url, {
          method: 'POST',
          headers: this.headers,
          body: JSON.stringify(body),
        });

        if (!response.ok) {
          const error = await response.text();
          throw new Error(`Chat API error: ${response.status} - ${error}`);
        }

        const data = (await response.json()) as ChatResponse | ZhipuChatResponse;
        const content = data.choices[0]?.message?.content;

        if (!content) {
          throw new Error('Empty response from chat API');
        }

        return content;
      },
      { maxAttempts: 2 }
    );
  }

  /**
   * Embedding generation
   */
  async embed(texts: string[]): Promise<number[][]> {
    return retry(
      async () => {
        let url: string;
        let body: any;

        if (this.provider === 'zhipu') {
          // Zhipu embedding API
          url = `${modelConfig.embed.baseUrl}/embeddings`;
          body = {
            model: modelConfig.embed.model,
            input: texts,
            encoding_format: 'float',
          };
        } else {
          // OpenAI-compatible format (vLLM)
          url = `${modelConfig.embed.baseUrl}/embeddings`;
          body = {
            model: modelConfig.embed.model,
            input: texts,
          };
        }

        const response = await fetch(url, {
          method: 'POST',
          headers: this.headers,
          body: JSON.stringify(body),
        });

        if (!response.ok) {
          const error = await response.text();
          throw new Error(`Embed API error: ${response.status} - ${error}`);
        }

        const data = (await response.json()) as EmbedResponse | ZhipuEmbedResponse;
        return data.data.map((d) => d.embedding);
      },
      { maxAttempts: 2 }
    );
  }

  /**
   * Reranking
   */
  async rerank(request: RerankRequest): Promise<RerankResponse['results']> {
    return retry(
      async () => {
        let url: string;
        let body: any;

        if (this.provider === 'zhipu') {
          // Zhipu rerank API
          url = `${modelConfig.rerank.baseUrl}/rerank`;
          body = {
            model: modelConfig.rerank.model,
            query: request.query,
            documents: request.documents.map((d) => d.text),
            top_n: request.top_n || request.documents.length,
          };
        } else {
          // OpenAI-compatible format (vLLM with BGE reranker)
          url = `${modelConfig.rerank.baseUrl}/rerank`;
          body = {
            model: modelConfig.rerank.model,
            query: request.query,
            documents: request.documents.map((d) => ({ text: d.text })),
            top_n: request.top_n || request.documents.length,
          };
        }

        const response = await fetch(url, {
          method: 'POST',
          headers: this.headers,
          body: JSON.stringify(body),
        });

        if (!response.ok) {
          const error = await response.text();
          throw new Error(`Rerank API error: ${response.status} - ${error}`);
        }

        const zhipuData = (await response.json()) as ZhipuRerankResponse;
        const data = (await response.json()) as RerankResponse;

        // Handle different response formats
        if (this.provider === 'zhipu') {
          return zhipuData.results.map((r) => ({
            index: r.index,
            document: request.documents[r.index],
            relevance_score: r.relevance_score,
          }));
        } else {
          return data.results.map((r) => ({
            index: r.index,
            document: request.documents[r.index],
            relevance_score: r.relevance_score,
          }));
        }
      },
      { maxAttempts: 2 }
    );
  }

  /**
   * Health check for all models
   */
  async healthCheck(): Promise<{
    chat: boolean;
    embed: boolean;
    rerank: boolean;
  }> {
    // For Zhipu, skip health check (cloud API reliability is guaranteed)
    // For local vLLM, check /models endpoint
    if (this.provider === 'zhipu') {
      return {
        chat: true,
        embed: true,
        rerank: true,
      };
    }

    // Local vLLM health check
    const results = await Promise.allSettled([
      fetch(`${modelConfig.chat.baseUrl}/models`),
      fetch(`${modelConfig.embed.baseUrl}/models`),
      fetch(`${modelConfig.rerank.baseUrl}/models`),
    ]);

    return {
      chat: results[0].status === 'fulfilled' && results[0].value.ok,
      embed: results[1].status === 'fulfilled' && results[1].value.ok,
      rerank: results[2].status === 'fulfilled' && results[2].value.ok,
    };
  }
}

export const modelGateway = new ModelGateway();
