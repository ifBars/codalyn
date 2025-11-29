"use client";
/**
 * React Hooks for AccuralAI
 */

import { useState, useCallback, useRef, useEffect } from 'react';
import { useAccuralAIContext } from './provider';
import { Agent, type AgentConfig, type AgentTask } from '../mdap/agent';
import { MDAPOrchestrator, type OrchestratorTask, type OrchestratorResult } from '../mdap/orchestrator';
import { TaskRouter } from '../mdap/task-router';
import { SubAgent, SubAgentPresets } from '../mdap/sub-agent';
import { createRequest } from '../contracts/models';
import type { GenerateResponse } from '../contracts/models';

export interface UseGenerateState {
  loading: boolean;
  error: Error | null;
  response: GenerateResponse | null;
}

export interface UseGenerateReturn extends UseGenerateState {
  generate: (prompt: string, options?: {
    systemPrompt?: string;
    temperature?: number;
    maxTokens?: number;
  }) => Promise<GenerateResponse>;
  reset: () => void;
}

/**
 * Hook for simple text generation
 */
export function useGenerate(backendName?: string): UseGenerateReturn {
  const { getBackend } = useAccuralAIContext();
  const [state, setState] = useState<UseGenerateState>({
    loading: false,
    error: null,
    response: null,
  });

  const generate = useCallback(async (prompt: string, options?: {
    systemPrompt?: string;
    temperature?: number;
    maxTokens?: number;
  }) => {
    setState({ loading: true, error: null, response: null });

    try {
      const backend = getBackend(backendName);
      if (!backend) {
        throw new Error(`Backend ${backendName || 'default'} not found`);
      }

      const request = createRequest({
        prompt,
        systemPrompt: options?.systemPrompt,
        parameters: {
          temperature: options?.temperature,
          maxTokens: options?.maxTokens,
        },
      });

      const response = await backend.generate(request, { routedTo: 'direct' });

      setState({ loading: false, error: null, response });
      return response;
    } catch (error) {
      const err = error instanceof Error ? error : new Error(String(error));
      setState({ loading: false, error: err, response: null });
      throw err;
    }
  }, [getBackend, backendName]);

  const reset = useCallback(() => {
    setState({ loading: false, error: null, response: null });
  }, []);

  return { ...state, generate, reset };
}

export interface UseAgentState {
  loading: boolean;
  error: Error | null;
  result: any | null;
  history: Array<{ role: string; content: string }>;
}

export interface UseAgentReturn extends UseAgentState {
  execute: (prompt: string) => Promise<any>;
  clearHistory: () => void;
}

/**
 * Hook for using a single agent
 */
export function useAgent(config: Omit<AgentConfig, 'backend'> & { backendName?: string }): UseAgentReturn {
  const { getBackend } = useAccuralAIContext();
  const [state, setState] = useState<UseAgentState>({
    loading: false,
    error: null,
    result: null,
    history: [],
  });

  const agentRef = useRef<Agent | null>(null);

  // Initialize agent
  useEffect(() => {
    const backend = getBackend(config.backendName);
    if (!backend) return;

    agentRef.current = new Agent({
      ...config,
      backend,
    });
  }, [getBackend, config.backendName]);

  const execute = useCallback(async (prompt: string) => {
    if (!agentRef.current) {
      throw new Error('Agent not initialized');
    }

    setState(prev => ({ ...prev, loading: true, error: null }));

    try {
      const task: AgentTask = {
        id: crypto.randomUUID(),
        prompt,
      };

      const result = await agentRef.current.execute(task);
      const history = agentRef.current.getHistory();

      setState({ loading: false, error: null, result, history });
      return result;
    } catch (error) {
      const err = error instanceof Error ? error : new Error(String(error));
      setState(prev => ({ ...prev, loading: false, error: err }));
      throw err;
    }
  }, []);

  const clearHistory = useCallback(() => {
    agentRef.current?.clearHistory();
    setState(prev => ({ ...prev, history: [] }));
  }, []);

  return { ...state, execute, clearHistory };
}

export interface UseSubAgentsConfig {
  agents: Record<string, {
    preset?: keyof typeof SubAgentPresets;
    config?: Partial<AgentConfig>;
  }>;
  backendName?: string;
}

export interface UseSubAgentsState {
  loading: boolean;
  error: Error | null;
  result: OrchestratorResult | null;
}

export interface UseSubAgentsReturn extends UseSubAgentsState {
  executeTask: (task: OrchestratorTask) => Promise<OrchestratorResult>;
  getStats: () => ReturnType<MDAPOrchestrator['getStats']> | null;
}

/**
 * Hook for using multiple sub-agents with orchestration
 */
export function useSubAgents(config: UseSubAgentsConfig): UseSubAgentsReturn {
  const { getBackend } = useAccuralAIContext();
  const [state, setState] = useState<UseSubAgentsState>({
    loading: false,
    error: null,
    result: null,
  });

  const orchestratorRef = useRef<MDAPOrchestrator | null>(null);

  // Initialize orchestrator and agents
  useEffect(() => {
    const backend = getBackend(config.backendName);
    if (!backend) return;

    const router = new TaskRouter();

    // Create sub-agents from config
    for (const [key, agentConfig] of Object.entries(config.agents)) {
      let subAgent: SubAgent;

      if (agentConfig.preset && agentConfig.preset in SubAgentPresets) {
        const presetConfig = SubAgentPresets[agentConfig.preset](backend);
        subAgent = new SubAgent({
          ...presetConfig,
          ...agentConfig.config,
        });
      } else if (agentConfig.config) {
        subAgent = new SubAgent({
          ...agentConfig.config,
          backend,
          specialization: key,
        } as any);
      } else {
        continue;
      }

      router.registerAgent(subAgent);
    }

    orchestratorRef.current = new MDAPOrchestrator({
      router,
      maxParallelTasks: 5,
      taskTimeout: 300000,
      retryFailedTasks: true,
      maxRetries: 2,
      generatePlanArtifact: true,
    });
  }, [getBackend, config.backendName]);

  const executeTask = useCallback(async (task: OrchestratorTask) => {
    if (!orchestratorRef.current) {
      throw new Error('Orchestrator not initialized');
    }

    setState(prev => ({ ...prev, loading: true, error: null }));

    try {
      const result = await orchestratorRef.current.execute(task);
      setState({ loading: false, error: null, result });
      return result;
    } catch (error) {
      const err = error instanceof Error ? error : new Error(String(error));
      setState(prev => ({ ...prev, loading: false, error: err }));
      throw err;
    }
  }, []);

  const getStats = useCallback(() => {
    return orchestratorRef.current?.getStats() || null;
  }, []);

  return { ...state, executeTask, getStats };
}

export interface UseStreamingState {
  loading: boolean;
  error: Error | null;
  content: string;
  done: boolean;
}

export interface UseStreamingReturn extends UseStreamingState {
  stream: (prompt: string) => Promise<void>;
  reset: () => void;
}

/**
 * Hook for streaming text generation
 */
export function useStreaming(backendName?: string): UseStreamingReturn {
  const { getBackend } = useAccuralAIContext();
  const [state, setState] = useState<UseStreamingState>({
    loading: false,
    error: null,
    content: '',
    done: false,
  });

  const stream = useCallback(async (prompt: string) => {
    setState({ loading: true, error: null, content: '', done: false });

    try {
      const backend = getBackend(backendName) as any;
      if (!backend) {
        throw new Error(`Backend ${backendName || 'default'} not found`);
      }

      if (!backend.generateStream) {
        throw new Error('Backend does not support streaming');
      }

      const request = createRequest({ prompt });

      const streamGenerator = backend.generateStream(request, { routedTo: 'streaming' });

      for await (const chunk of streamGenerator) {
        setState(prev => ({
          ...prev,
          loading: true,
          content: chunk.outputText || prev.content,
        }));
      }

      setState(prev => ({ ...prev, loading: false, done: true }));
    } catch (error) {
      const err = error instanceof Error ? error : new Error(String(error));
      setState(prev => ({ ...prev, loading: false, error: err, done: true }));
      throw err;
    }
  }, [getBackend, backendName]);

  const reset = useCallback(() => {
    setState({ loading: false, error: null, content: '', done: false });
  }, []);

  return { ...state, stream, reset };
}
