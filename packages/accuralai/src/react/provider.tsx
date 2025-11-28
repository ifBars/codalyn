"use client";
/**
 * React Context Provider for AccuralAI
 */

import { createContext, useContext, useMemo, type ReactNode } from 'react';
import type { Backend } from '../contracts/protocols';
import type { Cache } from '../contracts/protocols';
import { MemoryCache } from '../cache/memory';

export interface AccuralAIConfig {
  backends: Record<string, Backend>;
  cache?: Cache;
  defaultBackend?: string;
}

export interface AccuralAIContextValue {
  config: AccuralAIConfig;
  getBackend: (name?: string) => Backend | undefined;
  cache: Cache;
}

const AccuralAIContext = createContext<AccuralAIContextValue | null>(null);

export interface AccuralAIProviderProps {
  config: AccuralAIConfig;
  children: ReactNode;
}

export function AccuralAIProvider({ config, children }: AccuralAIProviderProps) {
  const value = useMemo<AccuralAIContextValue>(() => {
    const cache = config.cache || new MemoryCache({ maxEntries: 100 });

    return {
      config,
      getBackend: (name?: string) => {
        const backendName = name || config.defaultBackend;
        if (!backendName) {
          return Object.values(config.backends)[0];
        }
        return config.backends[backendName];
      },
      cache,
    };
  }, [config]);

  return <AccuralAIContext.Provider value={value}>{children}</AccuralAIContext.Provider>;
}

export function useAccuralAIContext(): AccuralAIContextValue {
  const context = useContext(AccuralAIContext);
  if (!context) {
    throw new Error('useAccuralAIContext must be used within AccuralAIProvider');
  }
  return context;
}
