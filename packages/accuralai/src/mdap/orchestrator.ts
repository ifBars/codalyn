/**
 * MDAP Orchestrator - Coordinates multiple agents working together
 */

import { Agent, type AgentTask, type AgentResult } from './agent';
import { TaskRouter, type RoutingDecision } from './task-router';
import { nanoid } from 'nanoid';
import { z } from 'zod';
import {
  ArtifactRegistry,
  createArtifactRegistry,
  ArtifactHelpers,
  type Artifact,
} from './artifacts';

export const OrchestratorConfigSchema = z.object({
  mainAgent: z.custom<Agent>().optional(),
  router: z.custom<TaskRouter>(),
  maxParallelTasks: z.number().int().positive().default(5),
  taskTimeout: z.number().int().positive().default(300000), // 5 minutes
  retryFailedTasks: z.boolean().default(true),
  maxRetries: z.number().int().nonnegative().default(2),
  generatePlanArtifact: z.boolean().default(true), // Generate markdown plan
});

export type OrchestratorConfig = z.infer<typeof OrchestratorConfigSchema>;

export type WorkflowMode = 'sequential' | 'parallel' | 'conditional';

export interface OrchestratorTask {
  prompt: string;
  workflow?: WorkflowMode;
  context?: Record<string, unknown>;
  metadata?: Record<string, unknown>;
}

export interface DecomposedPlan {
  objective: string;
  strategy: string;
  tasks: Array<{
    id: string;
    agentRole: string;
    description: string;
    complexity?: string;
    estimatedTime?: string;
  }>;
}

export interface OrchestratorResult {
  taskId: string;
  results: AgentResult[];
  finalOutput: string;
  workflow: WorkflowMode;
  routingDecisions: RoutingDecision[];
  executionTimeMs: number;
  /** All artifacts generated during execution */
  artifacts: Artifact[];
  /** Markdown plan artifact (if generated) */
  planArtifact?: Artifact;
  /** Decomposed plan structure */
  plan?: DecomposedPlan;
  metadata?: Record<string, unknown>;
}

export interface TaskExecution {
  taskId: string;
  agentId: string;
  startTime: number;
  endTime?: number;
  status: 'pending' | 'running' | 'completed' | 'failed';
  result?: AgentResult;
  error?: string;
  retries: number;
}

export class MDAPOrchestrator {
  private config: OrchestratorConfig;
  private mainAgent?: Agent;
  private router: TaskRouter;
  private taskExecutions: Map<string, TaskExecution> = new Map();
  private activeTasks: Set<string> = new Set();
  private artifactRegistry: ArtifactRegistry;

  constructor(config: OrchestratorConfig) {
    this.config = OrchestratorConfigSchema.parse(config);
    this.mainAgent = this.config.mainAgent;
    this.router = this.config.router;
    this.artifactRegistry = createArtifactRegistry();
  }

  /**
   * Execute a task using the orchestrator
   */
  async execute(task: OrchestratorTask): Promise<OrchestratorResult> {
    const startTime = Date.now();
    const taskId = nanoid();
    const workflow = task.workflow || 'sequential';
    const routingDecisions: RoutingDecision[] = [];
    const results: AgentResult[] = [];

    // Clear artifact registry for new execution
    this.artifactRegistry.clear();

    try {
      // If main agent exists, use it to decompose the task
      let subtasks: AgentTask[];
      let plan: DecomposedPlan | undefined;
      let planArtifact: Artifact | undefined;

      if (this.mainAgent && workflow !== 'parallel') {
        // Ask main agent to create a structured plan
        const planningPrompt = `You are a planning agent for the MDAP system. Decompose the following objective into a structured plan.

**Objective:** ${task.prompt}

Provide:
1. A clear strategy statement explaining the overall approach
2. A breakdown of 3-7 specific tasks assigned to specialized agent roles
3. For each task, specify: agent role, description, and complexity (Low/Medium/High)

Format your response as valid JSON following this structure:
{
  "objective": "...",
  "strategy": "...",
  "tasks": [
    {
      "id": "task-1",
      "agentRole": "Code Generator",
      "description": "...",
      "complexity": "Medium",
      "estimatedTime": "5-10 minutes"
    }
  ]
}`;

        const planningTask: AgentTask = {
          id: `${taskId}-planning`,
          prompt: planningPrompt,
          context: task.context,
          metadata: { ...task.metadata, type: 'planning' },
        };

        const planningResult = await this.mainAgent.execute(planningTask);

        // Parse the plan from JSON
        try {
          const jsonMatch = planningResult.output.match(/\{[\s\S]*\}/);
          if (jsonMatch) {
            plan = JSON.parse(jsonMatch[0]) as DecomposedPlan;

            // Create plan artifact if enabled
            if (this.config.generatePlanArtifact) {
              const planMarkdown = ArtifactHelpers.formatPlanMarkdown({
                title: 'MDAP Execution Plan',
                objective: plan.objective,
                strategy: plan.strategy,
                tasks: plan.tasks,
                timestamp: new Date(),
              });

              const planArtifactData = ArtifactHelpers.createPlan({
                filename: `plan-${taskId}`,
                content: planMarkdown,
                description: 'MDAP execution plan generated by planning agent',
                agentId: this.mainAgent.id,
                agentRole: this.mainAgent.role,
                taskId,
              });

              planArtifact = this.artifactRegistry.addOrUpdate(planArtifactData);
            }

            // Convert plan tasks to agent tasks
            subtasks = plan.tasks.map(t => ({
              id: t.id,
              prompt: t.description,
              context: task.context,
              parentTaskId: taskId,
              metadata: {
                ...task.metadata,
                agentRole: t.agentRole,
                complexity: t.complexity,
                estimatedTime: t.estimatedTime,
              },
            }));
          } else {
            // Fallback to simple parsing if JSON not found
            subtasks = this.parseSubtasks(planningResult.output, taskId, task);
          }
        } catch (parseError) {
          // Fallback to simple parsing on error
          subtasks = this.parseSubtasks(planningResult.output, taskId, task);
        }
      } else {
        // Create a single task
        subtasks = [
          {
            id: `${taskId}-main`,
            prompt: task.prompt,
            context: task.context,
            metadata: task.metadata,
          },
        ];
      }

      // Execute subtasks based on workflow mode
      switch (workflow) {
        case 'sequential':
          results.push(...(await this.executeSequential(subtasks, routingDecisions)));
          break;
        case 'parallel':
          results.push(...(await this.executeParallel(subtasks, routingDecisions)));
          break;
        case 'conditional':
          results.push(...(await this.executeConditional(subtasks, routingDecisions)));
          break;
      }

      // Combine results
      const finalOutput = results.map(r => r.output).join('\n\n');

      return {
        taskId,
        results,
        finalOutput,
        workflow,
        routingDecisions,
        executionTimeMs: Date.now() - startTime,
        artifacts: this.artifactRegistry.getAll(),
        planArtifact,
        plan,
        metadata: {
          subtaskCount: subtasks.length,
          agentsUsed: new Set(results.map(r => r.agentId)).size,
          artifactCount: this.artifactRegistry.count(),
        },
      };
    } catch (error) {
      throw new Error(
        `Orchestrator execution failed: ${error instanceof Error ? error.message : String(error)}`
      );
    }
  }

  /**
   * Execute tasks sequentially with context accumulation
   * Following the Aurelius pattern of passing context and artifacts forward
   */
  private async executeSequential(
    tasks: AgentTask[],
    routingDecisions: RoutingDecision[]
  ): Promise<AgentResult[]> {
    const results: AgentResult[] = [];
    const contextAccumulator: string[] = [];

    for (const task of tasks) {
      // Enhance task with accumulated context and artifacts
      const enhancedTask: AgentTask = {
        ...task,
        previousOutputs: [...contextAccumulator],
        existingArtifacts: this.artifactRegistry.getAll(),
      };

      const result = await this.executeTask(enhancedTask, routingDecisions);
      results.push(result);

      // Add result to context accumulator
      const agent = this.router.getAgent(result.agentId);
      const agentRole = agent?.role || result.agentId;
      contextAccumulator.push(
        `[Agent: ${agentRole}] ${result.output.substring(0, 500)}${result.output.length > 500 ? '...' : ''}`
      );

      // Add artifacts to registry
      if (result.artifacts && result.artifacts.length > 0) {
        result.artifacts.forEach(artifact => {
          this.artifactRegistry.addOrUpdate(artifact);
        });
      }
    }

    return results;
  }

  /**
   * Execute tasks in parallel
   */
  private async executeParallel(
    tasks: AgentTask[],
    routingDecisions: RoutingDecision[]
  ): Promise<AgentResult[]> {
    // Respect max parallel tasks limit
    const batches: AgentTask[][] = [];
    for (let i = 0; i < tasks.length; i += this.config.maxParallelTasks) {
      batches.push(tasks.slice(i, i + this.config.maxParallelTasks));
    }

    const results: AgentResult[] = [];

    for (const batch of batches) {
      // All tasks in batch get the same current artifacts
      const currentArtifacts = this.artifactRegistry.getAll();

      const enhancedBatch = batch.map(task => ({
        ...task,
        existingArtifacts: currentArtifacts,
      }));

      const batchResults = await Promise.all(
        enhancedBatch.map(task => this.executeTask(task, routingDecisions))
      );

      // Add artifacts from batch to registry
      batchResults.forEach(result => {
        if (result.artifacts && result.artifacts.length > 0) {
          result.artifacts.forEach(artifact => {
            this.artifactRegistry.addOrUpdate(artifact);
          });
        }
      });

      results.push(...batchResults);
    }

    return results;
  }

  /**
   * Execute tasks conditionally (sequential with context passing and artifacts)
   */
  private async executeConditional(
    tasks: AgentTask[],
    routingDecisions: RoutingDecision[]
  ): Promise<AgentResult[]> {
    const results: AgentResult[] = [];
    const contextAccumulator: string[] = [];
    let context = {};

    for (const task of tasks) {
      // Merge previous context and add artifacts
      const taskWithContext: AgentTask = {
        ...task,
        context: { ...context, ...task.context },
        previousOutputs: [...contextAccumulator],
        existingArtifacts: this.artifactRegistry.getAll(),
      };

      const result = await this.executeTask(taskWithContext, routingDecisions);
      results.push(result);

      // Update context with result
      context = {
        ...context,
        [`result_${task.id}`]: result.output,
      };

      // Add to context accumulator
      const agent = this.router.getAgent(result.agentId);
      const agentRole = agent?.role || result.agentId;
      contextAccumulator.push(
        `[Agent: ${agentRole}] ${result.output.substring(0, 500)}${result.output.length > 500 ? '...' : ''}`
      );

      // Add artifacts to registry
      if (result.artifacts && result.artifacts.length > 0) {
        result.artifacts.forEach(artifact => {
          this.artifactRegistry.addOrUpdate(artifact);
        });
      }
    }

    return results;
  }

  /**
   * Execute a single task with routing
   */
  private async executeTask(
    task: AgentTask,
    routingDecisions: RoutingDecision[]
  ): Promise<AgentResult> {
    let attempt = 0;

    while (attempt <= this.config.maxRetries) {
      try {
        // Route the task
        const decision = this.router.route(task);
        routingDecisions.push(decision);

        // Get the agent
        const agent = this.router.getAgent(decision.agentId);
        if (!agent) {
          throw new Error(`Agent ${decision.agentId} not found`);
        }

        // Track execution
        const execution: TaskExecution = {
          taskId: task.id,
          agentId: decision.agentId,
          startTime: Date.now(),
          status: 'running',
          retries: attempt,
        };
        this.taskExecutions.set(task.id, execution);
        this.activeTasks.add(task.id);

        // Execute with timeout
        const timeoutPromise = new Promise<never>((_, reject) =>
          setTimeout(() => reject(new Error('Task timeout')), this.config.taskTimeout)
        );

        const result = await Promise.race([
          agent.execute(task),
          timeoutPromise,
        ]);

        // Update execution
        execution.endTime = Date.now();
        execution.status = 'completed';
        execution.result = result;
        this.activeTasks.delete(task.id);

        return result;
      } catch (error) {
        attempt++;

        if (attempt > this.config.maxRetries || !this.config.retryFailedTasks) {
          const execution = this.taskExecutions.get(task.id);
          if (execution) {
            execution.status = 'failed';
            execution.error = error instanceof Error ? error.message : String(error);
            execution.endTime = Date.now();
          }
          this.activeTasks.delete(task.id);

          throw error;
        }

        // Wait before retry
        await new Promise(resolve => setTimeout(resolve, 1000 * attempt));
      }
    }

    throw new Error('Task execution failed after retries');
  }

  /**
   * Parse subtasks from agent output
   */
  private parseSubtasks(
    output: string,
    parentTaskId: string,
    originalTask: OrchestratorTask
  ): AgentTask[] {
    const lines = output
      .split('\n')
      .map(line => line.trim())
      .filter(line => line.length > 0 && !line.startsWith('#'));

    return lines.map((line, index) => ({
      id: `${parentTaskId}-${index}`,
      prompt: line.replace(/^\d+\.\s*/, '').replace(/^-\s*/, ''),
      context: originalTask.context,
      parentTaskId,
      metadata: originalTask.metadata,
    }));
  }

  /**
   * Get orchestrator statistics
   */
  getStats(): {
    activeTasks: number;
    totalExecutions: number;
    routerStats: ReturnType<TaskRouter['getStats']>;
    executions: TaskExecution[];
  } {
    return {
      activeTasks: this.activeTasks.size,
      totalExecutions: this.taskExecutions.size,
      routerStats: this.router.getStats(),
      executions: Array.from(this.taskExecutions.values()),
    };
  }

  /**
   * Clear execution history
   */
  clearHistory(): void {
    this.taskExecutions.clear();
    this.activeTasks.clear();
  }
}

/**
 * Create an MDAP orchestrator
 */
export function createOrchestrator(config: OrchestratorConfig): MDAPOrchestrator {
  return new MDAPOrchestrator(config);
}
