/**
 * Ollama backend adapter
 *
 * HTTP-based client for local Ollama instances
 * Documentation: https://github.com/ollama/ollama/blob/main/docs/api.md
 * API Reference: https://docs.ollama.com/api
 */

import type { Backend } from '../contracts/protocols';
import type { GenerateRequest, GenerateResponse } from '../contracts/models';
import { createResponse } from '../contracts/models';
import { z } from 'zod';

export const OllamaBackendConfigSchema = z.object({
  baseURL: z.string().default('http://localhost:11434'),
  defaultModel: z.string().default('llama3.2'),
  timeout: z.number().int().positive().default(120000), // 2 minutes
  keepAlive: z.string().optional(), // e.g., "5m"
});

export type OllamaBackendConfig = z.infer<typeof OllamaBackendConfigSchema>;

interface OllamaGenerateRequest {
  model: string;
  prompt: string;
  system?: string;
  template?: string;
  context?: number[];
  stream?: boolean;
  raw?: boolean;
  format?: string;
  options?: {
    temperature?: number;
    top_p?: number;
    top_k?: number;
    num_predict?: number;
    stop?: string[];
  };
  keep_alive?: string;
}

interface OllamaGenerateResponse {
  model: string;
  created_at: string;
  response: string;
  done: boolean;
  context?: number[];
  total_duration?: number;
  load_duration?: number;
  prompt_eval_count?: number;
  prompt_eval_duration?: number;
  eval_count?: number;
  eval_duration?: number;
}

export class OllamaBackend implements Backend {
  private config: OllamaBackendConfig;

  constructor(config?: Partial<OllamaBackendConfig>) {
    this.config = OllamaBackendConfigSchema.parse(config || {});
  }

  async generate(
    request: GenerateRequest,
    options: { routedTo: string }
  ): Promise<GenerateResponse> {
    const startTime = Date.now();

    try {
      // Extract model from parameters or use default
      const model = (request.parameters?.model as string) || this.config.defaultModel;

      // Build prompt with history if present
      let fullPrompt = request.prompt;
      if (request.history && request.history.length > 0) {
        const historyText = request.history
          .map((msg: any) => `${msg.role}: ${msg.content}`)
          .join('\n');
        fullPrompt = `${historyText}\nuser: ${request.prompt}\nassistant:`;
      }

      // Prepare Ollama request
      const ollamaRequest: OllamaGenerateRequest = {
        model,
        prompt: fullPrompt,
        system: request.systemPrompt,
        stream: false,
        options: {
          temperature: request.parameters?.temperature as number | undefined,
          top_p: request.parameters?.top_p as number | undefined,
          top_k: request.parameters?.top_k as number | undefined,
          num_predict: (request.parameters?.maxTokens as number) ||
                      (request.parameters?.max_tokens as number) || undefined,
          stop: request.parameters?.stop as string[] | undefined,
        },
        keep_alive: this.config.keepAlive,
      };

      // Make HTTP request to Ollama
      const response = await fetch(`${this.config.baseURL}/api/generate`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(ollamaRequest),
        signal: AbortSignal.timeout(this.config.timeout),
      });

      if (!response.ok) {
        throw new Error(`Ollama API error: ${response.status} ${response.statusText}`);
      }

      const data = await response.json() as OllamaGenerateResponse;
      const latencyMs = Date.now() - startTime;

      // Estimate tokens (Ollama provides eval_count)
      const promptTokens = data.prompt_eval_count || 0;
      const completionTokens = data.eval_count || 0;

      // Create AccuralAI response
      return createResponse({
        requestId: request.id,
        outputText: data.response,
        finishReason: data.done ? 'stop' : 'length',
        usage: {
          promptTokens,
          completionTokens,
          totalTokens: promptTokens + completionTokens,
          extra: {
            totalDuration: data.total_duration,
            loadDuration: data.load_duration,
            promptEvalDuration: data.prompt_eval_duration,
            evalDuration: data.eval_duration,
          },
        },
        latencyMs,
        metadata: {
          backend: 'ollama',
          model,
          routedTo: options.routedTo,
          context: data.context,
          rawResponse: data,
        },
      });
    } catch (error) {
      const latencyMs = Date.now() - startTime;

      // Handle timeout
      if (error instanceof Error && error.name === 'TimeoutError') {
        throw new Error(`Ollama request timeout after ${this.config.timeout}ms`);
      }

      // Return error response
      return createResponse({
        requestId: request.id,
        outputText: '',
        finishReason: 'error',
        usage: {
          promptTokens: 0,
          completionTokens: 0,
          totalTokens: 0,
          extra: {},
        },
        latencyMs,
        metadata: {
          backend: 'ollama',
          error: error instanceof Error ? error.message : String(error),
        },
      });
    }
  }

  /**
   * Streaming support
   */
  async *generateStream(
    request: GenerateRequest,
    _options: { routedTo: string }
  ): AsyncGenerator<Partial<GenerateResponse>> {
    const model = (request.parameters?.model as string) || this.config.defaultModel;

    let fullPrompt = request.prompt;
    if (request.history && request.history.length > 0) {
      const historyText = request.history
        .map((msg: any) => `${msg.role}: ${msg.content}`)
        .join('\n');
      fullPrompt = `${historyText}\nuser: ${request.prompt}\nassistant:`;
    }

    const ollamaRequest: OllamaGenerateRequest = {
      model,
      prompt: fullPrompt,
      system: request.systemPrompt,
      stream: true,
      options: {
        temperature: request.parameters?.temperature as number | undefined,
        num_predict: request.parameters?.maxTokens as number | undefined,
      },
      keep_alive: this.config.keepAlive,
    };

    const response = await fetch(`${this.config.baseURL}/api/generate`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(ollamaRequest),
    });

    if (!response.ok) {
      throw new Error(`Ollama API error: ${response.status}`);
    }

    if (!response.body) {
      throw new Error('No response body from Ollama');
    }

    const reader = response.body.getReader();
    const decoder = new TextDecoder();
    let accumulatedText = '';

    while (true) {
      const { done, value } = await reader.read();
      if (done) break;

      const chunk = decoder.decode(value, { stream: true });
      const lines = chunk.split('\n').filter(line => line.trim());

      for (const line of lines) {
        try {
          const data = JSON.parse(line) as OllamaGenerateResponse;
          if (data.response) {
            accumulatedText += data.response;

            yield {
              outputText: accumulatedText,
              metadata: {
                streaming: true,
                backend: 'ollama',
                done: data.done,
              },
            };
          }

          if (data.done) {
            return;
          }
        } catch (e) {
          // Ignore JSON parse errors for incomplete chunks
        }
      }
    }
  }

  /**
   * List available models
   */
  async listModels(): Promise<string[]> {
    const response = await fetch(`${this.config.baseURL}/api/tags`);

    if (!response.ok) {
      throw new Error(`Failed to list Ollama models: ${response.status}`);
    }

    const data = await response.json() as { models?: Array<{ name: string }> };
    return data.models?.map((m) => m.name) || [];
  }
}

/**
 * Factory function for creating Ollama backend
 */
export function createOllamaBackend(
  config?: Partial<OllamaBackendConfig>
): OllamaBackend {
  return new OllamaBackend(config);
}
