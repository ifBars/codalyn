/**
 * Task Router for MDAP - Routes tasks to appropriate sub-agents
 */

import type { SubAgent } from './sub-agent';
import type { AgentTask } from './agent';
import { z } from 'zod';

export const RoutingRuleSchema = z.object({
  name: z.string(),
  pattern: z.instanceof(RegExp).optional(),
  keywords: z.array(z.string()).optional(),
  capability: z.string().optional(),
  agentId: z.string(),
  priority: z.number().int().min(0).max(10).default(5),
});

export type RoutingRule = z.infer<typeof RoutingRuleSchema>;

export const TaskRouterConfigSchema = z.object({
  rules: z.array(RoutingRuleSchema).default([]),
  defaultAgentId: z.string().optional(),
  loadBalancing: z.boolean().default(true),
  fallbackToLeastLoaded: z.boolean().default(true),
});

export type TaskRouterConfig = z.infer<typeof TaskRouterConfigSchema>;

export interface RoutingDecision {
  agentId: string;
  confidence: number;
  reason: string;
  matchedRules: string[];
}

export class TaskRouter {
  private config: TaskRouterConfig;
  private agents: Map<string, SubAgent> = new Map();

  constructor(config?: Partial<TaskRouterConfig>) {
    this.config = TaskRouterConfigSchema.parse(config || {});
  }

  /**
   * Register an agent with the router
   */
  registerAgent(agent: SubAgent): void {
    this.agents.set(agent.id, agent);
  }

  /**
   * Unregister an agent
   */
  unregisterAgent(agentId: string): void {
    this.agents.delete(agentId);
  }

  /**
   * Route a task to the most appropriate agent
   */
  route(task: AgentTask): RoutingDecision {
    const matchedRules: RoutingRule[] = [];
    const scores: Map<string, number> = new Map();
    const reasons: Map<string, string[]> = new Map();

    // 1. Check explicit agent assignment in task metadata
    if (task.metadata?.agentId) {
      const agentId = task.metadata.agentId as string;
      if (this.agents.has(agentId)) {
        return {
          agentId,
          confidence: 1.0,
          reason: 'Explicitly assigned agent',
          matchedRules: [],
        };
      }
    }

    // 2. Match against routing rules
    for (const rule of this.config.rules) {
      let matches = false;
      const ruleReasons: string[] = [];

      // Check pattern match
      if (rule.pattern && rule.pattern.test(task.prompt)) {
        matches = true;
        ruleReasons.push(`Pattern match: ${rule.pattern}`);
      }

      // Check keyword match
      if (rule.keywords && rule.keywords.length > 0) {
        const promptLower = task.prompt.toLowerCase();
        const keywordMatches = rule.keywords.filter(kw =>
          promptLower.includes(kw.toLowerCase())
        );
        if (keywordMatches.length > 0) {
          matches = true;
          ruleReasons.push(`Keywords: ${keywordMatches.join(', ')}`);
        }
      }

      // Check capability match
      if (rule.capability && task.metadata?.requiredCapability === rule.capability) {
        matches = true;
        ruleReasons.push(`Capability: ${rule.capability}`);
      }

      if (matches) {
        matchedRules.push(rule);
        const currentScore = scores.get(rule.agentId) || 0;
        scores.set(rule.agentId, currentScore + rule.priority);

        const currentReasons = reasons.get(rule.agentId) || [];
        reasons.set(rule.agentId, [...currentReasons, ...ruleReasons]);
      }
    }

    // 3. If we have matches, select the highest scoring agent
    if (scores.size > 0) {
      let bestAgentId = '';
      let bestScore = -1;

      for (const [agentId, score] of scores.entries()) {
        const agent = this.agents.get(agentId);
        if (!agent) continue;

        // Check if agent can handle the task
        if (!agent.canHandle(task)) continue;

        // Apply load balancing penalty
        let adjustedScore = score;
        if (this.config.loadBalancing) {
          const load = agent.getLoad();
          adjustedScore = score * (1 - load.utilization * 0.5);
        }

        if (adjustedScore > bestScore) {
          bestScore = adjustedScore;
          bestAgentId = agentId;
        }
      }

      if (bestAgentId) {
        return {
          agentId: bestAgentId,
          confidence: Math.min(bestScore / 10, 1.0),
          reason: reasons.get(bestAgentId)?.join('; ') || 'Rule-based routing',
          matchedRules: matchedRules
            .filter(r => r.agentId === bestAgentId)
            .map(r => r.name),
        };
      }
    }

    // 4. Fallback to least loaded agent
    if (this.config.fallbackToLeastLoaded) {
      let leastLoadedAgent: SubAgent | null = null;
      let lowestLoad = Infinity;

      for (const agent of this.agents.values()) {
        if (!agent.canHandle(task)) continue;

        const load = agent.getLoad();
        if (load.utilization < lowestLoad) {
          lowestLoad = load.utilization;
          leastLoadedAgent = agent;
        }
      }

      if (leastLoadedAgent) {
        return {
          agentId: leastLoadedAgent.id,
          confidence: 0.5,
          reason: 'Least loaded agent fallback',
          matchedRules: [],
        };
      }
    }

    // 5. Use default agent if specified
    if (this.config.defaultAgentId && this.agents.has(this.config.defaultAgentId)) {
      return {
        agentId: this.config.defaultAgentId,
        confidence: 0.3,
        reason: 'Default agent',
        matchedRules: [],
      };
    }

    // 6. Last resort: pick any available agent
    const availableAgents = Array.from(this.agents.values()).filter(a => a.canHandle(task));
    if (availableAgents.length > 0) {
      const agent = availableAgents[0];
      if (!agent) {
        throw new Error('No available agents to handle task');
      }
      return {
        agentId: agent.id,
        confidence: 0.1,
        reason: 'No routing rules matched, using first available agent',
        matchedRules: [],
      };
    }

    throw new Error('No available agents to handle task');
  }

  /**
   * Get all registered agents
   */
  getAgents(): SubAgent[] {
    return Array.from(this.agents.values());
  }

  /**
   * Get agent by ID
   */
  getAgent(agentId: string): SubAgent | undefined {
    return this.agents.get(agentId);
  }

  /**
   * Get routing statistics
   */
  getStats(): {
    totalAgents: number;
    agents: Array<{
      id: string;
      name?: string;
      specialization: string;
      load: ReturnType<SubAgent['getLoad']>;
    }>;
  } {
    return {
      totalAgents: this.agents.size,
      agents: Array.from(this.agents.values()).map(agent => ({
        id: agent.id,
        name: agent.name,
        specialization: agent.specialization,
        load: agent.getLoad(),
      })),
    };
  }
}

/**
 * Create a task router
 */
export function createTaskRouter(config?: Partial<TaskRouterConfig>): TaskRouter {
  return new TaskRouter(config);
}

/**
 * Common routing rule presets
 */
export const RoutingRulePresets = {
  codeGeneration: {
    name: 'Code Generation',
    keywords: ['generate', 'create', 'build', 'implement', 'code', 'function', 'component'],
    agentId: 'code-generator',
    priority: 8,
  },
  testing: {
    name: 'Testing',
    keywords: ['test', 'spec', 'coverage', 'assert', 'mock'],
    pattern: /test|spec|coverage/i,
    agentId: 'tester',
    priority: 6,
  },
  codeReview: {
    name: 'Code Review',
    keywords: ['review', 'analyze', 'check', 'audit', 'security', 'optimize'],
    pattern: /review|analyze|check/i,
    agentId: 'code-reviewer',
    priority: 7,
  },
  design: {
    name: 'UI Design',
    keywords: ['design', 'style', 'ui', 'ux', 'layout', 'tailwind', 'css'],
    pattern: /design|style|layout|ui/i,
    agentId: 'ui-designer',
    priority: 5,
  },
  architecture: {
    name: 'Architecture',
    keywords: ['architecture', 'structure', 'pattern', 'design pattern', 'scalability'],
    pattern: /architect|structure|pattern/i,
    agentId: 'architect',
    priority: 9,
  },
  debugging: {
    name: 'Debugging',
    keywords: ['debug', 'fix', 'error', 'bug', 'issue', 'problem', 'troubleshoot'],
    pattern: /debug|fix|error|bug/i,
    agentId: 'debugger',
    priority: 10,
  },
  qualityAssurance: {
    name: 'Quality Assurance',
    keywords: ['qa', 'quality', 'review all', 'validate', 'check quality', 'assess'],
    pattern: /quality|validate|assess|review all/i,
    agentId: 'qa-agent',
    priority: 8,
  },
  finalization: {
    name: 'Finalization',
    keywords: ['finalize', 'integrate', 'complete', 'wrap up', 'finish', 'final'],
    pattern: /finaliz|integrat|complet|finish|final/i,
    agentId: 'finalizer',
    priority: 9,
  },
};
