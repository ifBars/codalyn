/**
 * Pipeline orchestration logic.
 *
 * Executes the configured generation pipeline:
 * canonicalize → cache → route → backend → validate → post-process
 */

import type {
  Backend,
  Cache,
  Canonicalizer,
  Instrumentation,
  PostProcessor,
  Router,
  Validator,
} from '../contracts/protocols';
import type { GenerateRequest, GenerateResponse } from '../contracts/models';
import type { ExecutionContext } from './context';
import { raiseWithContext } from '../contracts/errors';
import { measureLatency } from '../utils/timing';
import { type Tokenizer, DEFAULT_TOKENIZER } from '../utils/tokenizer';
import { instrumentStage } from './instrumentation';
import {
  BACKEND_CALLED,
  CACHE_HIT,
  CACHE_MISS,
  CACHE_STORE,
  ROUTE_SELECTED,
  VALIDATION_COMPLETE,
} from './events';

export type CacheStrategy = (request: GenerateRequest) => string | null;

export interface BackendMap {
  [backendId: string]: Backend;
}

export interface PipelineConfig {
  canonicalizer: Canonicalizer;
  cache: Cache | null;
  router: Router;
  backends: BackendMap;
  validator: Validator;
  postProcessors?: PostProcessor[];
  instrumentation: Instrumentation;
  cacheStrategy: CacheStrategy;
  stagePlugins: Record<string, string | undefined>;
  tokenizer?: Tokenizer;
}

export class Pipeline {
  private canonicalizer: Canonicalizer;
  private cache: Cache | null;
  private router: Router;
  private backends: BackendMap;
  private validator: Validator;
  private postProcessors: PostProcessor[];
  private instrumentation: Instrumentation;
  private cacheStrategy: CacheStrategy;
  private stagePlugins: Record<string, string | undefined>;
  private tokenizer: Tokenizer;

  constructor(config: PipelineConfig) {
    this.canonicalizer = config.canonicalizer;
    this.cache = config.cache;
    this.router = config.router;
    this.backends = config.backends;
    this.validator = config.validator;
    this.postProcessors = config.postProcessors || [];
    this.instrumentation = config.instrumentation;
    this.cacheStrategy = config.cacheStrategy;
    this.stagePlugins = config.stagePlugins;
    this.tokenizer = config.tokenizer || DEFAULT_TOKENIZER;
  }

  async run(ctx: ExecutionContext): Promise<GenerateResponse> {
    // 1. Canonicalize
    const canonical = await this.runStage('canonicalize', ctx, () =>
      this.canonicalizer.canonicalize(ctx.request)
    );

    // Ensure ID consistency
    if (canonical.id !== ctx.request.id) {
      canonical.id = ctx.request.id;
    }

    ctx.canonicalRequest = canonical;

    // 2. Cache lookup
    const cacheKey = this.cacheStrategy(canonical);
    let cachedResponse: GenerateResponse | null = null;
    let cacheLatencyMs = 0;

    if (cacheKey && this.cache) {
      const { result, elapsedMs } = await measureLatency(() =>
        this.cache!.get(cacheKey, { request: canonical })
      );
      cachedResponse = result;
      cacheLatencyMs = elapsedMs;

      if (cachedResponse) {
        cachedResponse.latencyMs = cacheLatencyMs;
        await ctx.recordEvent(CACHE_HIT, {
          cacheKey,
          backend: 'cache',
          latencyMs: cacheLatencyMs,
        });
      } else {
        await ctx.recordEvent(CACHE_MISS, { cacheKey, latencyMs: cacheLatencyMs });
      }
    }

    const responseSource = cachedResponse ? 'cache' : 'backend';

    // 3. Backend invocation (if cache miss)
    let response: GenerateResponse;
    if (cachedResponse) {
      response = this.ensureUsageTokens(cachedResponse, canonical);
    } else {
      const backendId = await this.runStage('router', ctx, () => this.router.route(canonical));

      await ctx.recordEvent(ROUTE_SELECTED, { backendId });

      response = await this.invokeBackend(ctx, backendId, canonical);
      response = this.ensureUsageTokens(response, canonical);

      // Store in cache
      if (cacheKey && this.cache) {
        await this.runStage('cache.set', ctx, () =>
          this.cache!.set(cacheKey, response)
        );
        await ctx.recordEvent(CACHE_STORE, { cacheKey });
      }
    }

    // 4. Validation
    const validated = await this.runStage('validator', ctx, () =>
      this.validator.validate(response, { request: canonical })
    );

    await ctx.recordEvent(VALIDATION_COMPLETE, {
      source: responseSource,
      finishReason: validated.finishReason,
    });

    // 5. Post-processing
    let finalResponse = validated;
    for (const [index, processor] of this.postProcessors.entries()) {
      finalResponse = await this.runStage(`post_process[${index}]`, ctx, () =>
        processor.process(finalResponse, { request: canonical })
      );
    }

    // Ensure request ID consistency
    if (finalResponse.requestId !== ctx.request.id) {
      finalResponse.requestId = ctx.request.id;
    }

    // Add metadata
    const cacheStatus = cachedResponse ? 'hit' : cacheKey && this.cache ? 'miss' : 'disabled';
    finalResponse.metadata = {
      ...finalResponse.metadata,
      cacheStatus,
      responseSource,
      ...(cacheKey && { cacheKey }),
    };

    ctx.response = finalResponse;
    return finalResponse;
  }

  private async invokeBackend(
    ctx: ExecutionContext,
    backendId: string,
    request: GenerateRequest
  ): Promise<GenerateResponse> {
    const backend = this.backends[backendId];
    if (!backend) {
      throw new Error(`Backend '${backendId}' is not registered`);
    }

    const { result, elapsedMs } = await measureLatency(() =>
      backend.generate(request, { routedTo: backendId })
    );

    if (result.latencyMs === 0) {
      result.latencyMs = elapsedMs;
    }

    await ctx.recordEvent(BACKEND_CALLED, { backendId, latencyMs: elapsedMs });

    return result;
  }

  private async runStage<T>(
    stage: string,
    ctx: ExecutionContext,
    fn: () => Promise<T>,
    pluginId?: string
  ): Promise<T> {
    ctx.ensureNotCancelled();
    ctx.markStageStart(stage);

    const resolvedPluginId = pluginId ?? this.stagePlugins[stage];
    const stageContext = {
      traceId: ctx.traceId,
      stage,
      pluginId: resolvedPluginId,
    };

    try {
      return await instrumentStage(this.instrumentation, stage, stageContext, fn);
    } catch (error) {
      raiseWithContext(error as Error, {
        stage,
        pluginId: resolvedPluginId,
        requestId: ctx.request.id,
      });
    } finally {
      ctx.markStageEnd(stage);
    }
  }

  private ensureUsageTokens(
    response: GenerateResponse,
    request: GenerateRequest
  ): GenerateResponse {
    const usage = response.usage;
    let promptTokens = usage.promptTokens;
    let completionTokens = usage.completionTokens;
    let totalTokens = usage.totalTokens;

    const updates: Partial<typeof usage> = {};

    if (promptTokens === 0) {
      promptTokens = this.tokenizer.countRequestTokens(request);
      updates.promptTokens = promptTokens;
    }

    if (completionTokens === 0) {
      completionTokens = this.tokenizer.countResponseTokens(response);
      updates.completionTokens = completionTokens;
    }

    if (totalTokens === 0) {
      totalTokens = promptTokens + completionTokens;
      updates.totalTokens = totalTokens;
    }

    if (Object.keys(updates).length === 0) {
      return response;
    }

    return {
      ...response,
      usage: { ...usage, ...updates },
    };
  }
}
