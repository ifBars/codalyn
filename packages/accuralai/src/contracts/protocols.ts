/**
 * Protocol definitions for pipeline stage abstractions.
 *
 * These interfaces mirror the Python protocols in accuralai_core.contracts.protocols.
 */

import type { GenerateRequest, GenerateResponse } from './models';

export type PluginFactory<T> = (...args: unknown[]) => Promise<T>;

/**
 * Normalizes a request prior to caching and routing.
 */
export interface Canonicalizer {
  canonicalize(request: GenerateRequest): Promise<GenerateRequest>;
}

/**
 * Caches responses keyed by request-specific identifiers.
 */
export interface Cache {
  get(
    key: string,
    options: { request: GenerateRequest }
  ): Promise<GenerateResponse | null>;
  set(key: string, value: GenerateResponse, options?: { ttl?: number }): Promise<void>;
  invalidate(key: string): Promise<void>;
  stats?: CacheStats;
}

export interface CacheStats {
  hits: number;
  misses: number;
  size: number;
  evictions?: number;
  hitRate?: number;
}

/**
 * Selects a backend identifier for the incoming request.
 */
export interface Router {
  route(request: GenerateRequest): Promise<string>;
}

/**
 * Calls an LLM backend using a routed request.
 */
export interface Backend {
  generate(
    request: GenerateRequest,
    options: { routedTo: string }
  ): Promise<GenerateResponse>;
}

/**
 * Validates or transforms a backend response.
 */
export interface Validator {
  validate(
    response: GenerateResponse,
    options: { request: GenerateRequest }
  ): Promise<GenerateResponse>;
}

/**
 * Enriches or reformats a response after validation.
 */
export interface PostProcessor {
  process(
    response: GenerateResponse,
    options: { request: GenerateRequest }
  ): Promise<GenerateResponse>;
}

/**
 * Publishes structured pipeline events for observability.
 */
export interface EventPublisher {
  publish(eventName: string, payload: Record<string, unknown>): Promise<void>;
}

/**
 * Observability hooks invoked around each pipeline stage.
 */
export interface Instrumentation {
  onStageStart(stage: string, context: Record<string, unknown>): Promise<void>;
  onStageEnd(stage: string, context: Record<string, unknown>): Promise<void>;
  onError(stage: string, error: Error, context: Record<string, unknown>): Promise<void>;
}
