/**
 * Zod schemas and TypeScript types for core data models.
 *
 * These schemas provide runtime validation and type inference.
 */

import { z } from 'zod';

/**
 * Token accounting information returned by a backend.
 */
export const UsageSchema = z
  .object({
    promptTokens: z.number().int().nonnegative().default(0),
    completionTokens: z.number().int().nonnegative().default(0),
    totalTokens: z.number().int().nonnegative().default(0),
    extra: z.record(z.unknown()).default({}),
  })
  .transform(usage => ({
    ...usage,
    totalTokens: usage.totalTokens || usage.promptTokens + usage.completionTokens,
  }));

export type Usage = z.infer<typeof UsageSchema>;

/**
 * Canonical representation of a text generation request.
 */
export const GenerateRequestSchema = z
  .object({
    id: z.string().uuid().default(() => crypto.randomUUID()),
    createdAt: z.date().default(() => new Date()),
    prompt: z.string(),
    systemPrompt: z.string().optional(),
    history: z.array(z.record(z.unknown())).default([]),
    metadata: z.record(z.unknown()).default({}),
    parameters: z.record(z.unknown()).default({}),
    cacheKey: z.string().optional(),
    routeHint: z.string().optional(),
    tags: z.array(z.string()).default([]),
    tools: z.array(z.record(z.unknown())).default([]),
  })
  .refine(req => req.prompt.trim().length > 0 || req.history.length > 0, {
    message: 'GenerateRequest.prompt must be non-empty or history must be provided',
  });

export type GenerateRequest = z.infer<typeof GenerateRequestSchema>;

/**
 * Tool call representation
 */
export const ToolCallSchema = z.object({
  id: z.string().optional(),
  name: z.string(),
  arguments: z.record(z.unknown()).or(z.string()),
});

export type ToolCall = z.infer<typeof ToolCallSchema>;

/**
 * Canonical representation of a text generation response.
 */
export const GenerateResponseSchema = z
  .object({
    id: z.string().uuid(),
    requestId: z.string().uuid(),
    outputText: z.string(),
    finishReason: z.enum(['stop', 'length', 'content_filter', 'error', 'tool_calls']),
    usage: UsageSchema,
    latencyMs: z.number().int().nonnegative(),
    metadata: z.record(z.unknown()).default({}),
    validatorEvents: z.array(z.record(z.unknown())).default([]),
    toolCalls: z.array(ToolCallSchema).optional(),
  })
  .refine(res => res.finishReason === 'error' || res.outputText.length > 0 || (res.toolCalls && res.toolCalls.length > 0), {
    message: 'GenerateResponse.outputText cannot be empty unless finishReason is error or toolCalls are present',
  });

export type GenerateResponse = z.infer<typeof GenerateResponseSchema>;

/**
 * Helper to create a GenerateRequest with validation.
 */
export function createRequest(
  data: Partial<GenerateRequest> & { prompt: string }
): GenerateRequest {
  return GenerateRequestSchema.parse(data);
}

/**
 * Helper to create a GenerateResponse with validation.
 */
export function createResponse(
  data: Omit<GenerateResponse, 'id' | 'validatorEvents'> & {
    id?: string;
    validatorEvents?: Array<Record<string, unknown>>;
  }
): GenerateResponse {
  return GenerateResponseSchema.parse({
    id: crypto.randomUUID(),
    validatorEvents: [],
    ...data,
  });
}
