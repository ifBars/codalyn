/**
 * Vercel AI SDK backend adapter
 *
 * Uses the `ai` package provider registry to unify OpenAI, Anthropic,
 * Google Gemini, and Ollama (community provider) behind one backend.
 */

import { createProviderRegistry, generateText, jsonSchema, tool } from 'ai';
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
  /**
   * Minimum delay between provider requests (ms). Requests are queued to avoid 429s.
   */
  rateLimitMs: z.number().int().positive().default(500),
});

export type VercelAIBackendConfig = z.infer<typeof VercelAIBackendConfigSchema>;

type ProviderRegistry = ReturnType<typeof createProviderRegistry>;

export class VercelAIBackend implements Backend {
  private config: VercelAIBackendConfig;
  private registry: ProviderRegistry;
  private requestQueue: Promise<unknown>;
  private lastRequestTime = 0;

  constructor(config?: Partial<VercelAIBackendConfig>) {
    this.config = VercelAIBackendConfigSchema.parse(config || {});
    this.registry = this.createRegistry();
    this.requestQueue = Promise.resolve();
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
    return this.enqueue(async () => {
    const start = Date.now();
    const modelId = this.resolveModelId(request);
    const provider = modelId.split(this.config.separator)[0] || 'unknown';

    console.log(`[AI Debug] VercelAIBackend.generate() - Provider: ${provider}, Model: ${modelId}`);
    console.log(`[AI Debug] Config keys: ${JSON.stringify(Object.keys(this.config))}`);
    console.log(`[AI Debug] Has Google config: ${this.config.google !== undefined}`);
    console.log(`[AI Debug] Rate limit (ms between requests): ${this.config.rateLimitMs}`);

    try {
      const messages = this.buildMessages(request);
      console.log(`[AI Debug] Built ${messages.length} messages for model`);

      // Log tool names for debugging
      const { toolset: toolsForModel, debugTools } = this.prepareTools(request.tools);
      const toolEntries = Object.entries(toolsForModel);
      if (toolEntries.length > 0) {
        // Check for invalid tool names according to Google's requirements
        const invalidTools = toolEntries.filter(([name]) => {
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
            invalidTools.map(([name]) => name));
        }
      }

      const model = (this.registry as any).languageModel(modelId);
      console.log(`[AI Debug] Model resolved from registry`);

      const result = await generateText({
        model,
        messages,
        tools: toolEntries.length > 0 ? (toolsForModel as any) : undefined,
        temperature: this.pickNumber(request.parameters, ['temperature']),
        maxTokens: this.pickNumber(request.parameters, ['maxTokens', 'max_tokens']),
        topP: this.pickNumber(request.parameters, ['topP', 'top_p']),
        providerOptions: (request.parameters?.providerOptions ||
          request.parameters?.provider_options) as any,
      } as any);

      const latencyMs = Date.now() - start;
      const usage = result.usage || {};

      // Extract tool calls from result
      const toolCalls = (result as any).toolCalls
        ? (result as any).toolCalls.map((tc: any) => {
            const rawArgs = tc.args ?? tc.arguments ?? tc.input;
            const normalizedArgs =
              rawArgs === undefined ? {} : typeof rawArgs === 'string' ? rawArgs : rawArgs;

            return {
              id: tc.toolCallId || tc.id,
              name: tc.toolName || tc.name,
              arguments: normalizedArgs,
            };
          })
        : undefined;

      const finishReason = this.mapFinishReason(result.finishReason);
      const outputText = result.text || '';
      const hasToolCalls = toolCalls && toolCalls.length > 0;
      
      // Validation requires: outputText cannot be empty unless finishReason is 'error' or toolCalls are present
      // If we have tool calls, empty outputText is valid
      // If we don't have tool calls and outputText is empty, we must set finishReason to 'error'
      let finalOutputText = outputText;
      let finalFinishReason: 'stop' | 'length' | 'content_filter' | 'error' | 'tool_calls';
      
      if (hasToolCalls) {
        finalFinishReason = 'tool_calls';
        // Empty outputText is valid when we have tool calls
      } else if (outputText.length === 0) {
        // Empty outputText without tool calls requires error finishReason
        finalFinishReason = 'error';
        finalOutputText = 'Model returned empty response';
      } else {
        finalFinishReason = finishReason;
      }

      return createResponse({
        requestId: request.id,
        outputText: finalOutputText,
        finishReason: finalFinishReason,
        usage: {
          promptTokens: (usage as any).promptTokens || 0,
          completionTokens: (usage as any).completionTokens || 0,
          totalTokens: (usage as any).totalTokens || 0,
          extra: {},
        },
        latencyMs,
        toolCalls,
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
    });
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
      const rawRole = typeof (msg as any).role === 'string' ? (msg as any).role : 'user';
      let role: 'system' | 'user' | 'assistant' = 'user';
      if (rawRole === 'system' || rawRole === 'assistant' || rawRole === 'user') {
        role = rawRole;
      } else if (rawRole === 'tool') {
        // Gemini only accepts system|user|assistant; collapse tool messages into assistant text
        role = 'assistant';
      }

      const content =
        typeof (msg as any).content === 'string'
          ? ((msg as any).content as string)
          : JSON.stringify((msg as any).content ?? msg);

      // Skip empty content messages
      if (!content || content.trim().length === 0) {
        continue;
      }

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
  private prepareTools(tools: Array<Record<string, unknown>>): {
    toolset: Record<string, unknown>;
    debugTools: Array<Record<string, unknown>>;
  } {
    const toolset: Record<string, unknown> = {};
    const debugTools: Array<Record<string, unknown>> = [];

    for (const raw of tools || []) {
      const name = typeof raw.name === 'string' ? raw.name : 'tool';
      const sanitizedName = this.sanitizeToolName(name);

      if (toolset[sanitizedName]) {
        console.warn(
          `[AI Debug] Duplicate tool name '${sanitizedName}' detected. Skipping subsequent definition.`
        );
        continue;
      }

      if (sanitizedName !== name) {
        console.warn(
          `[AI Debug] Sanitized tool name '${name}' -> '${sanitizedName}' to satisfy provider rules`
        );
      }

      const parameters = (raw as any).parameters || (raw as any).inputSchema;

      // Sanitize parameter schema for Google Gemini compatibility
      const sanitizedParameters = this.sanitizeParameterSchema(parameters);

      // Store human-readable debug info before tool() wraps schemas
      debugTools.push({
        name: sanitizedName,
        description: (raw as any).description,
        parameters: sanitizedParameters,
      });

      toolset[sanitizedName] = tool({
        description: (raw as any).description,
        inputSchema: sanitizedParameters ? jsonSchema(sanitizedParameters as any) : jsonSchema({ type: 'object' }),
      });
    }

    return { toolset, debugTools };
  }

  /**
   * Sanitize parameter schema to ensure Google Gemini compatibility.
   * Fixes common issues with required fields and array item schemas.
   */
  private sanitizeParameterSchema(schema: any): any {
    const normalize = (node: any): any => {
      if (!node || typeof node !== 'object') {
        return { type: 'object', properties: {}, required: [] };
      }

      const clone: any = { ...node };
      clone.type = clone.type || 'object';

      // Ensure properties object
      if (!clone.properties || typeof clone.properties !== 'object') {
        clone.properties = {};
      }

      // Sanitize nested property schemas
      for (const [propName, propDef] of Object.entries(clone.properties)) {
        if (!propDef || typeof propDef !== 'object') continue;

        // Handle arrays
        if ((propDef as any).type === 'array') {
          const arrDef: any = { ...propDef };
          const items = typeof arrDef.items === 'object' ? { ...arrDef.items } : {};
          if (!items.type) {
            items.type = 'object';
          }
          if (items.type === 'object') {
            items.properties = items.properties && typeof items.properties === 'object' ? items.properties : {};
            if (Array.isArray(items.required)) {
              items.required = items.required.filter((req: string) => items.properties[req] !== undefined);
            }
          }
          arrDef.items = items;
          clone.properties[propName] = arrDef;
          continue;
        }

        // Handle objects
        if ((propDef as any).type === 'object') {
          clone.properties[propName] = normalize(propDef);
          continue;
        }
      }

      // Filter required keys to those that exist
      if (Array.isArray(clone.required)) {
        clone.required = clone.required.filter((prop: string) => clone.properties[prop] !== undefined);
      }

      return clone;
    };

    return normalize(schema);
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

  /**
   * Queue requests to enforce a minimum delay between provider calls.
   * Prevents 429s by serializing calls with a configurable gap.
   */
  private enqueue<T>(fn: () => Promise<T>): Promise<T> {
    const run = this.requestQueue.then(async () => {
      const now = Date.now();
      const elapsed = now - this.lastRequestTime;
      const waitMs = Math.max(0, this.config.rateLimitMs - elapsed);
      if (waitMs > 0) {
        await new Promise(resolve => setTimeout(resolve, waitMs));
      }
      this.lastRequestTime = Date.now();
      return fn();
    });

    // Ensure queue continues even if a request throws
    this.requestQueue = run.then(
      () => undefined,
      () => undefined
    );

    return run;
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
