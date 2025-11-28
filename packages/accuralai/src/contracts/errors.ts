/**
 * Error classes and context enrichment utilities.
 */

export interface ErrorContext {
  stage?: string;
  pluginId?: string;
  requestId?: string;
  traceId?: string;
  [key: string]: unknown;
}

/**
 * Base error class for AccuralAI exceptions.
 */
export class AccuralAIError extends Error {
  public context: ErrorContext;

  constructor(message: string, context: ErrorContext = {}) {
    super(message);
    this.name = this.constructor.name;
    this.context = context;
    Error.captureStackTrace(this, this.constructor);
  }

  toJSON() {
    return {
      name: this.name,
      message: this.message,
      context: this.context,
      stack: this.stack,
    };
  }
}

/**
 * Raised when a pipeline stage fails.
 */
export class StageError extends AccuralAIError {}

/**
 * Raised when a backend invocation fails.
 */
export class BackendError extends AccuralAIError {}

/**
 * Raised when validation fails.
 */
export class ValidationError extends AccuralAIError {}

/**
 * Raised when a configuration is invalid.
 */
export class ConfigurationError extends AccuralAIError {}

/**
 * Raised when a plugin is not found or fails to load.
 */
export class PluginError extends AccuralAIError {}

/**
 * Raised when a cache operation fails.
 */
export class CacheError extends AccuralAIError {}

/**
 * Enriches an error with stage context and re-throws.
 */
export function raiseWithContext(error: Error, context: ErrorContext): never {
  if (error instanceof AccuralAIError) {
    error.context = { ...error.context, ...context };
    throw error;
  }

  throw new StageError(error.message, { ...context, originalError: error.name });
}

/**
 * Wraps an async function with context-aware error handling.
 */
export function withErrorContext<T>(
  fn: () => Promise<T>,
  context: ErrorContext
): Promise<T> {
  return fn().catch(error => raiseWithContext(error as Error, context));
}
