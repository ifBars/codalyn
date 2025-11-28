/**
 * Anthropic Claude backend adapter
 *
 * Based on official @anthropic-ai/sdk
 * Documentation: https://docs.anthropic.com
 * GitHub: https://github.com/anthropics/anthropic-sdk-typescript
 */

import Anthropic from '@anthropic-ai/sdk';
import type { Backend } from '../contracts/protocols';
import type { GenerateRequest, GenerateResponse } from '../contracts/models';
import { createResponse } from '../contracts/models';
import { z } from 'zod';

export const AnthropicBackendConfigSchema = z.object({
  apiKey: z.string().optional(),
  baseURL: z.string().optional(),
  defaultModel: z.string().default('claude-sonnet-4-5-20250929'),
  maxTokens: z.number().int().positive().default(4096),
  timeout: z.number().int().positive().optional(),
});

export type AnthropicBackendConfig = z.infer<typeof AnthropicBackendConfigSchema>;

export class AnthropicBackend implements Backend {
  private client: Anthropic;
  private config: AnthropicBackendConfig;

  constructor(config?: Partial<AnthropicBackendConfig>) {
    this.config = AnthropicBackendConfigSchema.parse(config || {});

    this.client = new Anthropic({
      apiKey: this.config.apiKey || process.env.ANTHROPIC_API_KEY,
      baseURL: this.config.baseURL,
      timeout: this.config.timeout,
    });
  }

  async generate(
    request: GenerateRequest,
    options: { routedTo: string }
  ): Promise<GenerateResponse> {
    const startTime = Date.now();

    try {
      // Extract model from parameters or use default
      const model = (request.parameters?.model as string) || this.config.defaultModel;
      const maxTokens = (request.parameters?.maxTokens as number) ||
                       (request.parameters?.max_tokens as number) ||
                       this.config.maxTokens;

      // Build messages array
      const messages: Anthropic.MessageParam[] = [];

      // Add history if present
      if (request.history && request.history.length > 0) {
        for (const msg of request.history) {
          messages.push({
            role: (msg.role as 'user' | 'assistant') || 'user',
            content: msg.content as string,
          });
        }
      }

      // Add current prompt
      messages.push({
        role: 'user',
        content: request.prompt,
      });

      // Create message with Anthropic SDK
      const response = await this.client.messages.create({
        model,
        max_tokens: maxTokens,
        messages,
        system: request.systemPrompt,
        temperature: request.parameters?.temperature as number | undefined,
        top_p: request.parameters?.top_p as number | undefined,
        stop_sequences: request.parameters?.stop_sequences as string[] | undefined,
        // Tools support if provided
        tools: request.tools && request.tools.length > 0
          ? (request.tools as unknown as Anthropic.Tool[])
          : undefined,
      });

      const latencyMs = Date.now() - startTime;

      // Extract text content
      const textContent = response.content
        .filter((block) => block.type === 'text')
        .map((block) => (block as Anthropic.TextBlock).text)
        .join('');

      // Map finish reason
      const finishReason = this.mapStopReason(response.stop_reason);

      // Create AccuralAI response
      return createResponse({
        requestId: request.id,
        outputText: textContent,
        finishReason,
        usage: {
          promptTokens: response.usage.input_tokens,
          completionTokens: response.usage.output_tokens,
          totalTokens: response.usage.input_tokens + response.usage.output_tokens,
          extra: {
            cacheReadInputTokens: (response.usage as any).cache_read_input_tokens,
            cacheCreationInputTokens: (response.usage as any).cache_creation_input_tokens,
          },
        },
        latencyMs,
        metadata: {
          backend: 'anthropic',
          model,
          routedTo: options.routedTo,
          anthropicId: response.id,
          stopReason: response.stop_reason,
          rawResponse: response,
        },
      });
    } catch (error) {
      const latencyMs = Date.now() - startTime;

      // Handle Anthropic-specific errors
      if (error instanceof Anthropic.APIError) {
        throw new Error(
          `Anthropic API error (${error.status}): ${error.message}`
        );
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
          backend: 'anthropic',
          error: error instanceof Error ? error.message : String(error),
        },
      });
    }
  }

  /**
   * Map Anthropic stop_reason to AccuralAI finishReason
   */
  private mapStopReason(
    stopReason: string | null
  ): 'stop' | 'length' | 'content_filter' | 'error' {
    switch (stopReason) {
      case 'end_turn':
      case 'stop_sequence':
        return 'stop';
      case 'max_tokens':
        return 'length';
      default:
        return 'stop';
    }
  }

  /**
   * Streaming support (optional advanced feature)
   */
  async *generateStream(
    request: GenerateRequest,
    _options: { routedTo: string }
  ): AsyncGenerator<Partial<GenerateResponse>> {
    const model = (request.parameters?.model as string) || this.config.defaultModel;
    const maxTokens = (request.parameters?.maxTokens as number) || this.config.maxTokens;

    const messages: Anthropic.MessageParam[] = [];

    if (request.history && request.history.length > 0) {
      for (const msg of request.history) {
        messages.push({
          role: (msg.role as 'user' | 'assistant') || 'user',
          content: msg.content as string,
        });
      }
    }

    messages.push({
      role: 'user',
      content: request.prompt,
    });

    const stream = await this.client.messages.create({
      model,
      max_tokens: maxTokens,
      messages,
      system: request.systemPrompt,
      temperature: request.parameters?.temperature as number | undefined,
      stream: true,
    });

    let accumulatedText = '';

    for await (const event of stream) {
      if (event.type === 'content_block_delta' && event.delta.type === 'text_delta') {
        accumulatedText += event.delta.text;

        yield {
          outputText: accumulatedText,
          metadata: {
            streaming: true,
            backend: 'anthropic',
          },
        };
      }
    }
  }
}

/**
 * Factory function for creating Anthropic backend
 */
export function createAnthropicBackend(
  config?: Partial<AnthropicBackendConfig>
): AnthropicBackend {
  return new AnthropicBackend(config);
}
