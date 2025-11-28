/**
 * Vercel AI SDK backend adapter
 *
 * Uses the `ai` package provider registry to unify OpenAI, Anthropic,
 * Google Gemini, and Ollama (community provider) behind one backend.
 */

import { createProviderRegistry, generateText, jsonSchema } from 'ai';
import { anthropic, createAnthropic } from '@ai-sdk/anthropic';
import { google, createGoogleGenerativeAI } from '@ai-sdk/google';
import { createOpenAI, openai as defaultOpenAI } from '@ai-sdk/openai';
import { createOllama, ollama as defaultOllama } from 'ollama-ai-provider-v2';
import { z } from 'zod';
import type { Backend } from '../contracts/protocols';
import type { GenerateRequest, GenerateResponse } from '../contracts/models';
import { createResponse } from '../contracts/models';

export const VercelAIBackendConfigSchema = z.object({
  defaultModel: z.string().default('openai:gpt-4o'),
  separator: z.string().default(':'), // provider prefix separator
  openai: z.record(z.unknown()).optional(),
  anthropic: z.record(z.unknown()).optional(),
  google: z.record(z.unknown()).optional(),
  ollama: z.record(z.unknown()).optional(),
});

export type VercelAIBackendConfig = z.infer<typeof VercelAIBackendConfigSchema>;

type ProviderRegistry = ReturnType<typeof createProviderRegistry>;

export class VercelAIBackend implements Backend {
  private config: VercelAIBackendConfig;
  private registry: ProviderRegistry;

  constructor(config?: Partial<VercelAIBackendConfig>) {
    this.config = VercelAIBackendConfigSchema.parse(config || {});
    this.registry = this.createRegistry();
  }

  private createRegistry(): ProviderRegistry {
    const openaiProvider =
      this.config.openai !== undefined ? createOpenAI(this.config.openai as any) : defaultOpenAI;
    const anthropicProvider =
      this.config.anthropic !== undefined
        ? createAnthropic(this.config.anthropic as any)
        : anthropic;
    const googleProvider =
      this.config.google !== undefined
        ? createGoogleGenerativeAI(this.config.google as any)
        : google;
    const ollamaProvider =
      this.config.ollama !== undefined ? createOllama(this.config.ollama as any) : defaultOllama;

    return createProviderRegistry(
      {
        openai: openaiProvider,
        anthropic: anthropicProvider,
        google: googleProvider,
        ollama: ollamaProvider,
      },
      { separator: this.config.separator }
    );
  }

  async generate(
    request: GenerateRequest,
    options: { routedTo: string }
  ): Promise<GenerateResponse> {
    const start = Date.now();
    const modelId = this.resolveModelId(request);
    const provider = modelId.split(this.config.separator)[0] || 'unknown';

    console.log(`[AI Debug] VercelAIBackend.generate() - Provider: ${provider}, Model: ${modelId}`);
    console.log(`[AI Debug] Config keys: ${JSON.stringify(Object.keys(this.config))}`);
    console.log(`[AI Debug] Has Google config: ${this.config.google !== undefined}`);

    try {
      const messages = this.buildMessages(request);
      console.log(`[AI Debug] Built ${messages.length} messages for model`);

      // Log tool names for debugging
      const toolsForModel = this.prepareTools(request.tools);
      if (toolsForModel.length > 0) {
        console.log(`[AI Debug] Sending ${toolsForModel.length} tools to model`);
        const toolNames = toolsForModel.slice(0, 5).map((t: any) => t.name);
        console.log(`[AI Debug] First 5 tool names:`, toolNames);
        console.log(
          `[AI Debug] First tool full structure:`,
          JSON.stringify(toolsForModel[0], null, 2)
        );

        // Check for invalid tool names according to Google's requirements
        const invalidTools = toolsForModel.filter((t: any) => {
          const name = t.name as string;
          // Must start with letter or underscore
          if (!/^[a-zA-Z_]/.test(name)) return true;
          // Must be alphanumeric (a-z, A-Z, 0-9), underscores (_), dots (.), colons (:), or dashes (-)
          if (!/^[a-zA-Z0-9_.:_-]+$/.test(name)) return true;
          // Maximum 64 characters
          if (name.length > 64) return true;
          return false;
        });

        if (invalidTools.length > 0) {
          console.warn(`[AI Debug] Found ${invalidTools.length} tools with invalid names for Google:`,
            invalidTools.map((t: any) => t.name));
        }
      }

      const model = (this.registry as any).languageModel(modelId);
      console.log(`[AI Debug] Model resolved from registry`);

      const result = await generateText({
        model,
        messages,
        tools: toolsForModel.length > 0 ? (toolsForModel as any) : undefined,
        temperature: this.pickNumber(request.parameters, ['temperature']),
        maxTokens: this.pickNumber(request.parameters, ['maxTokens', 'max_tokens']),
        topP: this.pickNumber(request.parameters, ['topP', 'top_p']),
        providerOptions: (request.parameters?.providerOptions ||
          request.parameters?.provider_options) as any,
      } as any);

      const latencyMs = Date.now() - start;
      const usage = result.usage || {};

      return createResponse({
        requestId: request.id,
        outputText: result.text || '',
        finishReason: this.mapFinishReason(result.finishReason),
        usage: {
          promptTokens: (usage as any).promptTokens || 0,
          completionTokens: (usage as any).completionTokens || 0,
          totalTokens: (usage as any).totalTokens || 0,
          extra: {},
        },
        latencyMs,
        metadata: {
          backend: 'vercel-ai',
          provider,
          model: modelId,
          routedTo: options.routedTo,
          rawResponse: result,
        },
      });
    } catch (error) {
      const latencyMs = Date.now() - start;
      console.error(`[AI Debug] VercelAIBackend.generate() - Error:`, error);
      console.error(`[AI Debug] Error details:`, {
        message: error instanceof Error ? error.message : String(error),
        stack: error instanceof Error ? error.stack : undefined,
      });

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
          backend: 'vercel-ai',
          provider,
          model: modelId,
          routedTo: options.routedTo,
          error: error instanceof Error ? error.message : String(error),
        },
      });
    }
  }

  private resolveModelId(request: GenerateRequest): string {
    const rawModel =
      (request.parameters?.model as string | undefined) ||
      (request.parameters?.modelId as string | undefined) ||
      this.config.defaultModel;

    if (rawModel.includes(this.config.separator)) {
      return rawModel;
    }

    const defaultPrefix = this.config.defaultModel.split(this.config.separator)[0] || 'openai';
    return `${defaultPrefix}${this.config.separator}${rawModel}`;
  }

  private buildMessages(
    request: GenerateRequest
  ): Array<{ role: 'system' | 'user' | 'assistant'; content: string }> {
    const messages: Array<{ role: 'system' | 'user' | 'assistant'; content: string }> = [];

    if (request.systemPrompt) {
      messages.push({ role: 'system', content: request.systemPrompt });
    }

    for (const msg of request.history || []) {
      const role =
        (typeof (msg as any).role === 'string'
          ? ((msg as any).role as 'system' | 'user' | 'assistant')
          : 'user') || 'user';
      const content =
        typeof (msg as any).content === 'string'
          ? ((msg as any).content as string)
          : JSON.stringify(msg);

      messages.push({ role, content });
    }

    messages.push({ role: 'user', content: request.prompt });

    return messages;
  }

  private pickNumber(
    params: Record<string, unknown> | undefined,
    keys: string[]
  ): number | undefined {
    if (!params) return undefined;

    for (const key of keys) {
      const value = params[key];
      if (typeof value === 'number') {
        return value;
      }
    }

    return undefined;
  }

  private mapFinishReason(
    finishReason: string | null | undefined
  ): 'stop' | 'length' | 'content_filter' | 'error' {
    switch (finishReason) {
      case 'stop':
      case 'tool-calls':
      case 'tool_calls':
      case 'function_call':
      case 'tool_call':
        return 'stop';
      case 'length':
        return 'length';
      case 'content_filter':
      case 'content-filter':
        return 'content_filter';
      default:
        return 'error';
    }
  }

  /**
   * Convert Codalyn tool definitions into the format expected by Vercel AI SDK.
   * Ensures names meet Google Gemini requirements and uses function tools with JSON Schema input.
   */
  private prepareTools(tools: Array<Record<string, unknown>>): Array<Record<string, unknown>> {
    return (tools || []).map(raw => {
      const name = typeof raw.name === 'string' ? raw.name : 'tool';
      const sanitizedName = this.sanitizeToolName(name);

      if (sanitizedName !== name) {
        console.warn(
          `[AI Debug] Sanitized tool name '${name}' -> '${sanitizedName}' to satisfy provider rules`
        );
      }

      const parameters = (raw as any).parameters || (raw as any).inputSchema;

      return {
        type: 'function',
        name: sanitizedName,
        description: (raw as any).description,
        inputSchema: parameters ? jsonSchema(parameters as any) : jsonSchema({ type: 'object' }),
      };
    });
  }

  /**
   * Enforce Google Gemini naming rules: start with letter/underscore, allow alphanumerics,
   * underscores, dots, colons, and dashes, max length 64. Invalid characters are stripped.
   */
  private sanitizeToolName(name: string): string {
    let sanitized = name.replace(/[^a-zA-Z0-9_.:-]/g, '_');
    if (!/^[a-zA-Z_]/.test(sanitized)) {
      sanitized = `_${sanitized}`;
    }
    if (sanitized.length > 64) {
      sanitized = sanitized.slice(0, 64);
    }
    return sanitized;
  }
}

/**
 * Factory function for creating Vercel AI backend
 */
export function createVercelAIBackend(
  config?: Partial<VercelAIBackendConfig>
): VercelAIBackend {
  return new VercelAIBackend(config);
}
