/**
 * OpenAI backend adapter
 *
 * Based on official openai package
 * Documentation: https://platform.openai.com/docs/api-reference
 * GitHub: https://github.com/openai/openai-node
 */

import OpenAI from 'openai';
import type { Backend } from '../contracts/protocols';
import type { GenerateRequest, GenerateResponse } from '../contracts/models';
import { createResponse } from '../contracts/models';
import { z } from 'zod';

export const OpenAIBackendConfigSchema = z.object({
  apiKey: z.string().optional(),
  baseURL: z.string().optional(),
  organization: z.string().optional(),
  defaultModel: z.string().default('gpt-4o'),
  timeout: z.number().int().positive().optional(),
  // Azure OpenAI support
  azureEndpoint: z.string().optional(),
  azureApiVersion: z.string().optional(),
  azureDeployment: z.string().optional(),
});

export type OpenAIBackendConfig = z.infer<typeof OpenAIBackendConfigSchema>;

export class OpenAIBackend implements Backend {
  private client: OpenAI;
  private config: OpenAIBackendConfig;

  constructor(config?: Partial<OpenAIBackendConfig>) {
    this.config = OpenAIBackendConfigSchema.parse(config || {});

    // Azure OpenAI configuration
    if (this.config.azureEndpoint) {
      this.client = new OpenAI({
        apiKey: this.config.apiKey || process.env.AZURE_OPENAI_API_KEY,
        baseURL: `${this.config.azureEndpoint}/openai/deployments/${this.config.azureDeployment}`,
        defaultQuery: { 'api-version': this.config.azureApiVersion },
        defaultHeaders: { 'api-key': this.config.apiKey },
      });
    } else {
      // Standard OpenAI configuration
      this.client = new OpenAI({
        apiKey: this.config.apiKey || process.env.OPENAI_API_KEY,
        baseURL: this.config.baseURL,
        organization: this.config.organization,
        timeout: this.config.timeout,
      });
    }
  }

  async generate(
    request: GenerateRequest,
    options: { routedTo: string }
  ): Promise<GenerateResponse> {
    const startTime = Date.now();

    try {
      // Extract model from parameters or use default
      const model = (request.parameters?.model as string) || this.config.defaultModel;

      // Build messages array
      const messages: OpenAI.Chat.ChatCompletionMessageParam[] = [];

      // Add system prompt if present
      if (request.systemPrompt) {
        messages.push({
          role: 'system',
          content: request.systemPrompt,
        });
      }

      // Add history if present
      if (request.history && request.history.length > 0) {
        for (const msg of request.history) {
          messages.push({
            role: (msg.role as 'user' | 'assistant' | 'system') || 'user',
            content: msg.content as string,
          });
        }
      }

      // Add current prompt
      messages.push({
        role: 'user',
        content: request.prompt,
      });

      // Create chat completion
      const maxTokens = (request.parameters?.maxTokens || request.parameters?.max_tokens) as number | undefined;
      const completion = await this.client.chat.completions.create({
        model,
        messages,
        temperature: request.parameters?.temperature as number | undefined,
        max_tokens: maxTokens,
        top_p: request.parameters?.top_p as number | undefined,
        frequency_penalty: request.parameters?.frequency_penalty as number | undefined,
        presence_penalty: request.parameters?.presence_penalty as number | undefined,
        stop: request.parameters?.stop as string | string[] | undefined,
        // Function calling support
        tools: request.tools && request.tools.length > 0
          ? request.tools as any
          : undefined,
        tool_choice: request.parameters?.tool_choice as any,
      });

      const latencyMs = Date.now() - startTime;

      const choice = completion.choices[0];
      if (!choice) {
        throw new Error('No completion choices returned from OpenAI');
      }

      // Extract text content
      const outputText = choice.message.content || '';

      // Map finish reason
      const finishReason = this.mapFinishReason(choice.finish_reason);

      // Create AccuralAI response
      return createResponse({
        requestId: request.id,
        outputText,
        finishReason,
        usage: {
          promptTokens: completion.usage?.prompt_tokens || 0,
          completionTokens: completion.usage?.completion_tokens || 0,
          totalTokens: completion.usage?.total_tokens || 0,
          extra: {
            completionTokensDetails: completion.usage?.completion_tokens_details,
            promptTokensDetails: completion.usage?.prompt_tokens_details,
          },
        },
        latencyMs,
        metadata: {
          backend: 'openai',
          model,
          routedTo: options.routedTo,
          openaiId: completion.id,
          finishReason: choice.finish_reason,
          toolCalls: choice.message.tool_calls,
          rawResponse: completion,
        },
      });
    } catch (error) {
      const latencyMs = Date.now() - startTime;

      // Handle OpenAI-specific errors
      if (error instanceof OpenAI.APIError) {
        throw new Error(
          `OpenAI API error (${error.status}): ${error.message}`
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
          backend: 'openai',
          error: error instanceof Error ? error.message : String(error),
        },
      });
    }
  }

  /**
   * Map OpenAI finish_reason to AccuralAI finishReason
   */
  private mapFinishReason(
    finishReason: string | null | undefined
  ): 'stop' | 'length' | 'content_filter' | 'error' {
    switch (finishReason) {
      case 'stop':
      case 'tool_calls':
      case 'function_call':
        return 'stop';
      case 'length':
        return 'length';
      case 'content_filter':
        return 'content_filter';
      default:
        return 'error';
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

    const messages: OpenAI.Chat.ChatCompletionMessageParam[] = [];

    if (request.systemPrompt) {
      messages.push({
        role: 'system',
        content: request.systemPrompt,
      });
    }

    if (request.history && request.history.length > 0) {
      for (const msg of request.history) {
        messages.push({
          role: (msg.role as 'user' | 'assistant' | 'system') || 'user',
          content: msg.content as string,
        });
      }
    }

    messages.push({
      role: 'user',
      content: request.prompt,
    });

    const stream = await this.client.chat.completions.create({
      model,
      messages,
      temperature: request.parameters?.temperature as number | undefined,
      max_tokens: request.parameters?.maxTokens as number | undefined,
      stream: true,
    });

    let accumulatedText = '';

    for await (const chunk of stream) {
      const delta = chunk.choices[0]?.delta;
      if (delta?.content) {
        accumulatedText += delta.content;

        yield {
          outputText: accumulatedText,
          metadata: {
            streaming: true,
            backend: 'openai',
          },
        };
      }
    }
  }
}

/**
 * Factory function for creating OpenAI backend
 */
export function createOpenAIBackend(
  config?: Partial<OpenAIBackendConfig>
): OpenAIBackend {
  return new OpenAIBackend(config);
}
