/**
 * Sub-Agent for specialized tasks in MDAP
 */

import { Agent, type AgentConfig, type AgentTask, type AgentResult } from './agent';
import { z } from 'zod';

export const SubAgentConfigSchema = z.object({
  specialization: z.string(),
  capabilities: z.array(z.string()).default([]),
  priority: z.number().int().min(0).max(10).default(5),
  maxConcurrentTasks: z.number().int().positive().default(1),
});

export type SubAgentConfig = z.infer<typeof SubAgentConfigSchema> &
  Omit<AgentConfig, 'id' | 'metadata' | 'temperature' | 'maxTokens' | 'maxIterations'> &
  Partial<Pick<AgentConfig, 'id' | 'metadata' | 'temperature' | 'maxTokens' | 'maxIterations'>>;

export interface SubAgentCapability {
  name: string;
  description: string;
  pattern?: RegExp;
  keywords?: string[];
}

export class SubAgent extends Agent {
  public readonly specialization: string;
  public readonly capabilities: string[];
  public readonly priority: number;
  private maxConcurrentTasks: number;
  private activeTasks: Set<string> = new Set();

  constructor(config: SubAgentConfig) {
    // Cast to AgentConfig since SubAgentConfig includes all required AgentConfig fields
    // and the parent constructor will parse and fill defaults via AgentConfigSchema
    super(config as AgentConfig);

    const subConfig = SubAgentConfigSchema.parse(config);
    this.specialization = subConfig.specialization;
    this.capabilities = subConfig.capabilities;
    this.priority = subConfig.priority;
    this.maxConcurrentTasks = subConfig.maxConcurrentTasks;
  }

  /**
   * Check if agent can handle a task
   */
  canHandle(task: AgentTask): boolean {
    // Check concurrent task limit
    if (this.activeTasks.size >= this.maxConcurrentTasks) {
      return false;
    }

    // Check capabilities match
    if (task.metadata?.requiredCapability) {
      return this.capabilities.includes(task.metadata.requiredCapability as string);
    }

    return true;
  }

  /**
   * Execute task (override with tracking)
   */
  async execute(task: AgentTask): Promise<AgentResult> {
    // Add to active tasks
    this.activeTasks.add(task.id);

    try {
      // Execute with parent class
      const result = await super.execute(task);

      // Add sub-agent specific metadata
      return {
        ...result,
        metadata: {
          ...result.metadata,
          specialization: this.specialization,
          capabilities: this.capabilities,
          priority: this.priority,
        },
      };
    } finally {
      // Remove from active tasks
      this.activeTasks.delete(task.id);
    }
  }

  /**
   * Get current load
   */
  getLoad(): {
    active: number;
    max: number;
    utilization: number;
  } {
    return {
      active: this.activeTasks.size,
      max: this.maxConcurrentTasks,
      utilization: this.activeTasks.size / this.maxConcurrentTasks,
    };
  }

  /**
   * Get sub-agent info
   */
  getSubAgentInfo(): {
    id: string;
    name?: string;
    role?: string;
    specialization: string;
    capabilities: string[];
    priority: number;
    load: {
      active: number;
      max: number;
      utilization: number;
    };
  } {
    return {
      ...this.getInfo(),
      specialization: this.specialization,
      capabilities: this.capabilities,
      priority: this.priority,
      load: this.getLoad(),
    };
  }
}

/**
 * Create a sub-agent
 */
export function createSubAgent(config: SubAgentConfig): SubAgent {
  return new SubAgent(config);
}

/**
 * Common sub-agent presets for web development
 */
export const SubAgentPresets = {
  codeGenerator: (backend: any): SubAgentConfig => ({
    id: 'code-generator',
    name: 'Code Generator',
    role: 'code-generation',
    specialization: 'code-generation',
    capabilities: ['react', 'typescript', 'html', 'css', 'javascript'],
    systemPrompt: `You are an expert code generator specialized in React, TypeScript, and modern web development.

CRITICAL: You have access to file operation tools. You MUST use them to create actual files:
- Use write_file to create new files with code
- Use read_file to check existing files
- Use list_directory to see what files exist
- For small edits, prefer replace_in_file, append_to_file, or insert_at_line instead of rewriting whole files.

Follow the architect's plan exactly. Do NOT change or extend the plan—implement it in code. If the plan is unclear, note assumptions briefly and continue coding.

DO NOT just describe what files should be created. ACTUALLY CREATE THEM using the write_file tool.

Generate clean, production-ready code and write it to files immediately.`,
    backend,
    priority: 8,
    temperature: 0.3,
    maxTokens: 4096,
    metadata: {},
    maxConcurrentTasks: 1,
  }),

  tester: (backend: any): SubAgentConfig => ({
    id: 'tester',
    name: 'Test Engineer',
    role: 'testing',
    specialization: 'testing',
    capabilities: ['unit-tests', 'integration-tests', 'vitest', 'jest'],
    systemPrompt: `You are a testing specialist. Write comprehensive, meaningful tests with good coverage.

You have access to file operation tools. Use write_file to create:
- Test files (.test.ts, .spec.ts)
- Test fixtures and mocks
- Test configuration
Implement tests for the planned work only; do not change the plan. Use replace_in_file/append_to_file for incremental additions.

Create actual test files, don't just describe them.`,
    backend,
    priority: 6,
    temperature: 0.2,
    maxTokens: 4096,
    metadata: {},
    maxConcurrentTasks: 1,
  }),

  reviewer: (backend: any): SubAgentConfig => ({
    id: 'code-reviewer',
    name: 'Code Reviewer',
    role: 'code-review',
    specialization: 'code-review',
    capabilities: ['security', 'performance', 'best-practices'],
    systemPrompt: `You are a senior code reviewer. Identify bugs, security issues, and suggest improvements. Do NOT implement new features or alter the plan—only review and recommend precise fixes. If changes are needed, provide targeted instructions (prefer replace_in_file/append_to_file/insert_at_line).`,
    backend,
    priority: 7,
    temperature: 0.4,
    maxTokens: 4096,
    metadata: {},
    maxConcurrentTasks: 1,
  }),

  designer: (backend: any): SubAgentConfig => ({
    id: 'ui-designer',
    name: 'UI Designer',
    role: 'design',
    specialization: 'ui-design',
    capabilities: ['tailwind', 'css', 'responsive-design', 'accessibility'],
    systemPrompt: `You are a UI/UX designer expert in Tailwind CSS and modern design systems.

You have access to file operation tools. Use write_file to create:
- CSS files with styling
- Tailwind configuration
- Component styles
- For incremental tweaks, prefer replace_in_file, append_to_file, or insert_at_line instead of overwriting entire files. Always read_file first to understand context.

Create beautiful, accessible interfaces with actual files, not just descriptions.`,
    backend,
    priority: 5,
    temperature: 0.7,
    maxTokens: 4096,
    metadata: {},
    maxConcurrentTasks: 1,
  }),

  architect: (backend: any): SubAgentConfig => ({
    id: 'architect',
    name: 'Software Architect',
    role: 'architecture',
    specialization: 'architecture',
    capabilities: ['system-design', 'scalability', 'patterns'],
    systemPrompt: `You are the planning architect. Your ONLY job is to analyze requirements and output a clear, actionable plan. Do NOT implement or modify code.

Planning requirements:
- Produce a concise plan with numbered tasks, owners/roles, and clear goals.
- Identify which files to read or update, but DO NOT call write_file or modify code yourself.
- Suggest precise, small actions for other agents (code generator, designer, tester, debugger, QA, finalizer).
- Call read_file or list_directory ONLY when you need context; otherwise stay high-level.
- Prefer targeted edits in instructions (replace_in_file/append_to_file/insert_at_line) rather than full rewrites.
- Output should be planning text only. Never propose or execute file writes.`,
    backend,
    priority: 9,
    temperature: 0.5,
    maxTokens: 4096,
    metadata: {},
    maxConcurrentTasks: 1,
  }),

  debugger: (backend: any): SubAgentConfig => ({
    id: 'debugger',
    name: 'Debugger',
    role: 'debugging',
    specialization: 'debugging',
    capabilities: ['error-analysis', 'troubleshooting', 'performance-profiling'],
    systemPrompt: `You are a debugging expert. Analyze errors, identify root causes, and fix them.

You have access to file operation tools. Use them to:
- Read files to understand the code
- Write fixed versions of files
- Check for syntax errors
- Favor replace_in_file, append_to_file, or insert_at_line for small fixes; only rewrite whole files when necessary.

Don't just suggest fixes - MAKE THE FIXES using write_file.`,
    backend,
    priority: 10,
    temperature: 0.3,
    maxTokens: 4096,
    metadata: {},
    maxConcurrentTasks: 1,
  }),

  qualityAssurance: (backend: any): SubAgentConfig => ({
    id: 'qa-agent',
    name: 'Quality Assurance Agent',
    role: 'quality-assurance',
    specialization: 'quality-assurance',
    capabilities: ['code-review', 'testing', 'validation', 'quality-control'],
    systemPrompt: 'You are a QA specialist. Review all outputs from previous agents, identify issues, gaps, or improvements needed. Provide a comprehensive quality assessment.',
    backend,
    priority: 8,
    temperature: 0.4,
    maxTokens: 4096,
    metadata: {},
    maxConcurrentTasks: 1,
  }),

  finalizer: (backend: any): SubAgentConfig => ({
    id: 'finalizer',
    name: 'Finalizer Agent',
    role: 'finalizer',
    specialization: 'finalization',
    capabilities: ['integration', 'cleanup', 'documentation', 'final-review'],
    systemPrompt: 'You are the finalizer agent. Review all previous work and provide a CONCISE summary (1-2 paragraphs maximum) of what was accomplished. Focus on the key deliverables and outcomes. Be brief and clear.',
    backend,
    priority: 9,
    temperature: 0.3,
    maxTokens: 512,
    metadata: {},
    maxConcurrentTasks: 1,
  }),
};
