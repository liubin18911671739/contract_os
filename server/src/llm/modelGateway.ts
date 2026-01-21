/**
 * Model Gateway - Unified client for vLLM (chat, embed, rerank)
 */
import { modelConfig } from '../config/model.js';
import { retry } from '../utils/retry.js';

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

interface EmbedResponse {
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

export class ModelGateway {
  private headers: Record<string, string>;

  constructor() {
    this.headers = {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${modelConfig.chat.apiKey}`,
    };
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
        const response = await fetch(`${modelConfig.chat.baseUrl}/chat/completions`, {
          method: 'POST',
          headers: this.headers,
          body: JSON.stringify({
            model: modelConfig.chat.model,
            messages,
            temperature,
            max_tokens: maxTokens,
            ...(jsonMode && { response_format: { type: 'json_object' } }),
          }),
        });

        if (!response.ok) {
          const error = await response.text();
          throw new Error(`Chat API error: ${response.status} - ${error}`);
        }

        const data = (await response.json()) as ChatResponse;
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
        const response = await fetch(`${modelConfig.embed.baseUrl}/embeddings`, {
          method: 'POST',
          headers: this.headers,
          body: JSON.stringify({
            model: modelConfig.embed.model,
            input: texts,
          }),
        });

        if (!response.ok) {
          const error = await response.text();
          throw new Error(`Embed API error: ${response.status} - ${error}`);
        }

        const data = (await response.json()) as EmbedResponse;
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
        const response = await fetch(`${modelConfig.rerank.baseUrl}/rerank`, {
          method: 'POST',
          headers: this.headers,
          body: JSON.stringify({
            model: modelConfig.rerank.model,
            query: request.query,
            documents: request.documents.map((d) => ({ text: d.text })),
            top_n: request.top_n || request.documents.length,
          }),
        });

        if (!response.ok) {
          const error = await response.text();
          throw new Error(`Rerank API error: ${response.status} - ${error}`);
        }

        const data = (await response.json()) as RerankResponse;
        return data.results.map((r) => ({
          index: r.index,
          document: request.documents[r.index],
          relevance_score: r.relevance_score,
        }));
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
