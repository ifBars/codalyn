/**
 * Instrumentation helpers for pipeline observability.
 */

import type { Instrumentation } from '../contracts/protocols';

/**
 * Wraps a function with instrumentation hooks.
 */
export async function instrumentStage<T>(
  instrumentation: Instrumentation,
  stage: string,
  context: Record<string, unknown>,
  fn: () => Promise<T>
): Promise<T> {
  await instrumentation.onStageStart(stage, context);

  try {
    const result = await fn();
    await instrumentation.onStageEnd(stage, context);
    return result;
  } catch (error) {
    await instrumentation.onError(stage, error as Error, context);
    throw error;
  }
}

/**
 * No-op instrumentation implementation.
 */
export class NoopInstrumentation implements Instrumentation {
  async onStageStart(_stage: string, _context: Record<string, unknown>): Promise<void> {
    // No-op
  }

  async onStageEnd(_stage: string, _context: Record<string, unknown>): Promise<void> {
    // No-op
  }

  async onError(
    _stage: string,
    _error: Error,
    _context: Record<string, unknown>
  ): Promise<void> {
    // No-op
  }
}

/**
 * Console logging instrumentation for debugging.
 */
export class ConsoleInstrumentation implements Instrumentation {
  async onStageStart(stage: string, context: Record<string, unknown>): Promise<void> {
    console.log(`[${stage}] START`, context);
  }

  async onStageEnd(stage: string, context: Record<string, unknown>): Promise<void> {
    console.log(`[${stage}] END`, context);
  }

  async onError(stage: string, error: Error, context: Record<string, unknown>): Promise<void> {
    console.error(`[${stage}] ERROR`, error.message, context);
  }
}
