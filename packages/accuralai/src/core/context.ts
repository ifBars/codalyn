/**
 * Execution context for tracking pipeline state.
 */

import type { GenerateRequest, GenerateResponse } from '../contracts/models';
import { nanoid } from 'nanoid';

export interface ExecutionContext {
  readonly traceId: string;
  readonly request: GenerateRequest;
  canonicalRequest?: GenerateRequest;
  response?: GenerateResponse;
  readonly events: Array<{ name: string; payload: Record<string, unknown>; timestamp: Date }>;
  readonly stages: Map<string, { startedAt: Date; endedAt?: Date }>;
  cancelled: boolean;

  recordEvent(name: string, payload: Record<string, unknown>): Promise<void>;
  markStageStart(stage: string): void;
  markStageEnd(stage: string): void;
  ensureNotCancelled(): void;
}

export function createExecutionContext(request: GenerateRequest): ExecutionContext {
  const traceId = nanoid();
  const events: Array<{ name: string; payload: Record<string, unknown>; timestamp: Date }> = [];
  const stages = new Map<string, { startedAt: Date; endedAt?: Date }>();
  let cancelled = false;

  return {
    traceId,
    request,
    events,
    stages,
    cancelled,

    async recordEvent(name: string, payload: Record<string, unknown>) {
      events.push({ name, payload, timestamp: new Date() });
    },

    markStageStart(stage: string) {
      stages.set(stage, { startedAt: new Date() });
    },

    markStageEnd(stage: string) {
      const entry = stages.get(stage);
      if (entry) {
        entry.endedAt = new Date();
      }
    },

    ensureNotCancelled() {
      if (cancelled) {
        throw new Error('Execution context has been cancelled');
      }
    },
  };
}
