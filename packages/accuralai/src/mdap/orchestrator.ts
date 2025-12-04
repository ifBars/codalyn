/**
 * MDAP Orchestrator - Coordinates multiple agents working together
 */

import { Agent, type AgentTask, type AgentResult } from './agent';
import { TaskRouter, type RoutingDecision } from './task-router';
import { nanoid } from 'nanoid';
import {
  ArtifactRegistry,
  createArtifactRegistry,
  ArtifactHelpers,
  type Artifact,
} from './artifacts';
import { z } from 'zod';

export const OrchestratorConfigSchema = z.object({
  mainAgent: z.custom<Agent>().optional(),
  router: z.custom<TaskRouter>(),
  maxParallelTasks: z.number().int().positive().default(5),
  taskTimeout: z.number().int().positive().default(300000), // 5 minutes
  retryFailedTasks: z.boolean().default(true),
  maxRetries: z.number().int().nonnegative().default(2),
  generatePlanArtifact: z.boolean().default(true), // Generate markdown plan
  artifactSink: z
    .function()
    .args(z.any())
    .returns(z.any())
    .optional(),
});

export type OrchestratorConfig = z.infer<typeof OrchestratorConfigSchema>;

export type WorkflowMode = 'sequential' | 'parallel' | 'conditional';

export interface OrchestratorTask {
  prompt: string;
  workflow?: WorkflowMode;
  context?: Record<string, unknown>;
  metadata?: Record<string, unknown>;
  /** Existing plan artifacts that may be referenced in the prompt */
  existingPlans?: Artifact[];
}

export interface DecomposedPlan {
  name?: string; // Optional plan name (if not provided, will be auto-generated)
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
  /** Current iteration number (0-indexed) */
  currentIteration?: number;
  /** Maximum iterations allowed */
  maxIterations?: number;
  /** Currently executing tool call */
  currentToolCall?: {
    name: string;
    args: any;
    startedAt: number;
  };
  /** History of completed tool calls */
  completedToolCalls?: Array<{
    name: string;
    args: any;
    result?: any;
    error?: string;
    duration: number;
    success: boolean;
  }>;
  /** Task description from decomposed plan */
  taskDescription?: string;
}

export class MDAPOrchestrator {
  private config: OrchestratorConfig;
  private mainAgent?: Agent;
  private router: TaskRouter;
  private taskExecutions: Map<string, TaskExecution> = new Map();
  private activeTasks: Set<string> = new Set();
  private artifactRegistry: ArtifactRegistry;
  private artifactSink?: (artifact: Artifact) => Promise<void> | void;

  constructor(config: OrchestratorConfig) {
    this.config = OrchestratorConfigSchema.parse(config);
    this.mainAgent = this.config.mainAgent;
    this.router = this.config.router;
    this.artifactRegistry = createArtifactRegistry();
    this.artifactSink = this.config.artifactSink;
  }

  /**
   * Determine if a plan artifact should be created based on task complexity
   */
  private shouldCreatePlan(plan: DecomposedPlan, task: OrchestratorTask): boolean {
    // Don't create plan artifact if disabled in config
    if (!this.config.generatePlanArtifact) {
      return false;
    }

    // Create plan artifact if:
    // 1. Plan has multiple tasks (3+ tasks indicates coordination needed)
    // 2. Plan has tasks with different agent roles (requires coordination)
    // 3. Plan has high complexity tasks
    const hasMultipleTasks = plan.tasks.length >= 3;
    const hasMultipleRoles = new Set(plan.tasks.map(t => t.agentRole)).size > 1;
    const hasHighComplexity = plan.tasks.some(t => 
      t.complexity?.toLowerCase() === 'high' || 
      t.complexity?.toLowerCase() === 'medium'
    );

    return hasMultipleTasks || (hasMultipleRoles && hasHighComplexity);
  }

  /**
   * Find referenced plan artifact from existing plans
   */
  private findReferencedPlan(task: OrchestratorTask, planName?: string): Artifact | undefined {
    if (!task.existingPlans || task.existingPlans.length === 0) {
      return undefined;
    }

    // Try to match by plan name (sanitized)
    if (planName) {
      const sanitizedPlanName = planName
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, '-')
        .replace(/^-|-$/g, '');
      
      return task.existingPlans.find(plan => {
        const sanitizedFilename = plan.filename
          .toLowerCase()
          .replace(/[^a-z0-9]+/g, '-')
          .replace(/^-|-$/g, '')
          .replace(/\.md$/, '');
        return sanitizedFilename.includes(sanitizedPlanName) || 
               sanitizedPlanName.includes(sanitizedFilename);
      });
    }

    return undefined;
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
1. A descriptive name for this plan (short, clear, descriptive - e.g., "Build Todo Component", "Add Authentication System")
2. A clear strategy statement explaining the overall approach
3. A breakdown of 3-7 specific tasks assigned to specialized agent roles
4. For each task, specify: agent role, description, and complexity (Low/Medium/High)

Format your response as valid JSON following this structure:
{
  "name": "Descriptive Plan Name",
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

            // Only create plan artifact if task complexity warrants it
            if (this.shouldCreatePlan(plan, task)) {
              const planName = plan.name || plan.objective || 'MDAP Execution Plan';
              
              // Check if user referenced an existing plan
              const referencedPlan = this.findReferencedPlan(task, planName);
              
              if (referencedPlan) {
                // Update existing plan artifact instead of creating new one
                const planMarkdown = ArtifactHelpers.formatPlanMarkdown({
                  title: plan.name || 'MDAP Execution Plan',
                  objective: plan.objective,
                  strategy: plan.strategy,
                  tasks: plan.tasks,
                  timestamp: new Date(),
                });

                const updatedPlanData = {
                  id: referencedPlan.id, // Use existing ID to update
                  filename: referencedPlan.filename, // Keep same filename
                  path: referencedPlan.path, // Keep same path so addOrUpdate can find it
                  content: planMarkdown,
                  type: 'plan' as const,
                  mimeType: 'text/markdown',
                  metadata: {
                    ...referencedPlan.metadata,
                    description: plan.name || plan.objective || referencedPlan.metadata.description,
                    updatedAt: new Date(),
                    taskId,
                  },
                };

                planArtifact = await this.addArtifact(updatedPlanData);
              } else {
                // Create new plan artifact
                const sanitizedPlanName = planName
                  .toLowerCase()
                  .replace(/[^a-z0-9]+/g, '-')
                  .replace(/^-|-$/g, '')
                  .substring(0, 50) || 'plan';
                
                const planFilename = `${sanitizedPlanName}-${taskId.substring(0, 8)}`;
                
                const planMarkdown = ArtifactHelpers.formatPlanMarkdown({
                  title: plan.name || 'MDAP Execution Plan',
                  objective: plan.objective,
                  strategy: plan.strategy,
                  tasks: plan.tasks,
                  timestamp: new Date(),
                });

                const planArtifactData = ArtifactHelpers.createPlan({
                  filename: planFilename,
                  content: planMarkdown,
                  description: plan.name || plan.objective || 'MDAP execution plan generated by planning agent',
                  agentId: this.mainAgent.id,
                  agentRole: this.mainAgent.role,
                  taskId,
                });

                planArtifact = await this.addArtifact(planArtifactData);
              }
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
                taskDescription: t.description, // Store description in metadata for later retrieval
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
          results.push(...(await this.executeSequential(subtasks, routingDecisions, plan)));
          break;
        case 'parallel':
          results.push(...(await this.executeParallel(subtasks, routingDecisions, plan)));
          break;
        case 'conditional':
          results.push(...(await this.executeConditional(subtasks, routingDecisions, plan)));
          break;
      }

      // Combine results
      const finalOutput = results.map(r => r.output).join('\n\n');

      // Check for errors after execution completes
      const errorFixResults = await this.checkAndFixErrors(routingDecisions, taskId);

      return {
        taskId,
        results: [...results, ...errorFixResults],
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
          errorFixIterations: errorFixResults.length,
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
    routingDecisions: RoutingDecision[],
    plan?: DecomposedPlan // Phase 0.2: Pass master plan to agents
  ): Promise<AgentResult[]> {
    const results: AgentResult[] = [];
    const contextAccumulator: string[] = [];

    for (const task of tasks) {
      // Enhance task with accumulated context and artifacts
      const enhancedTask: AgentTask = {
        ...task,
        previousOutputs: [...contextAccumulator],
        existingArtifacts: this.artifactRegistry.getAll(),
        masterPlan: plan // Phase 0.2: Include master plan
          ? {
              objective: plan.objective,
              strategy: plan.strategy,
              tasks: plan.tasks.map(t => ({
                id: t.id,
                agentRole: t.agentRole,
                description: t.description,
              })),
            }
          : undefined,
      };

      // Get task description from plan or metadata
      const taskDescription = plan?.tasks.find(t => t.id === task.id)?.description || 
                              task.metadata?.taskDescription as string | undefined;

      const result = await this.executeTask(enhancedTask, routingDecisions, taskDescription);
      results.push(result);

      // Add result to context accumulator
      const agent = this.router.getAgent(result.agentId);
      const agentRole = agent?.role || result.agentId;
      const MAX_CONTEXT_PER_AGENT = 1000; // Phase 0.1: Increased from 500 to 1000 chars
      contextAccumulator.push(
        `[Agent: ${agentRole}] ${result.output.substring(0, MAX_CONTEXT_PER_AGENT)}${result.output.length > MAX_CONTEXT_PER_AGENT ? '...' : ''}`
      );

      // Add artifacts to registry
      if (result.artifacts && result.artifacts.length > 0) {
        for (const artifact of result.artifacts) {
          await this.addArtifact(artifact);
        }
      }
    }

    return results;
  }

  /**
   * Execute tasks in parallel
   */
  private async executeParallel(
    tasks: AgentTask[],
    routingDecisions: RoutingDecision[],
    plan?: DecomposedPlan // Phase 0.2: Pass master plan to agents
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
        masterPlan: plan // Phase 0.2: Include master plan
          ? {
              objective: plan.objective,
              strategy: plan.strategy,
              tasks: plan.tasks.map(t => ({
                id: t.id,
                agentRole: t.agentRole,
                description: t.description,
              })),
            }
          : undefined,
      }));

      const batchResults = await Promise.all(
        enhancedBatch.map(task => {
          const taskDescription = plan?.tasks.find(t => t.id === task.id)?.description || 
                                  task.metadata?.taskDescription as string | undefined;
          return this.executeTask(task, routingDecisions, taskDescription);
        })
      );

      // Add artifacts from batch to registry
      for (const result of batchResults) {
        if (result.artifacts && result.artifacts.length > 0) {
          for (const artifact of result.artifacts) {
            await this.addArtifact(artifact);
          }
        }
      }

      results.push(...batchResults);
    }

    return results;
  }

  /**
   * Execute tasks conditionally (sequential with context passing and artifacts)
   */
  private async executeConditional(
    tasks: AgentTask[],
    routingDecisions: RoutingDecision[],
    plan?: DecomposedPlan // Phase 0.2: Pass master plan to agents
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
        masterPlan: plan // Phase 0.2: Include master plan
          ? {
              objective: plan.objective,
              strategy: plan.strategy,
              tasks: plan.tasks.map(t => ({
                id: t.id,
                agentRole: t.agentRole,
                description: t.description,
              })),
            }
          : undefined,
      };

      // Get task description from plan or metadata
      const taskDescription = plan?.tasks.find(t => t.id === task.id)?.description || 
                              task.metadata?.taskDescription as string | undefined;

      const result = await this.executeTask(taskWithContext, routingDecisions, taskDescription);
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
        for (const artifact of result.artifacts) {
          await this.addArtifact(artifact);
        }
      }
    }

    return results;
  }

  /**
   * Execute a single task with routing
   */
  private async executeTask(
    task: AgentTask,
    routingDecisions: RoutingDecision[],
    taskDescription?: string
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
          taskDescription: taskDescription || task.metadata?.agentRole || task.prompt.substring(0, 100),
        };
        this.taskExecutions.set(task.id, execution);
        this.activeTasks.add(task.id);

        // Create enhanced task with progress callback
        const enhancedTask: AgentTask = {
          ...task,
          onProgress: (update) => {
            // Update execution with progress information
            const currentExecution = this.taskExecutions.get(task.id);
            if (currentExecution) {
              currentExecution.currentIteration = update.iteration;
              currentExecution.maxIterations = update.maxIterations;
              currentExecution.currentToolCall = update.currentToolCall;
              
              // Update completed tool calls
              if (update.completedToolCalls) {
                currentExecution.completedToolCalls = update.completedToolCalls;
              }
            }
            
            // Also call original progress callback if provided
            task.onProgress?.(update);
          },
        };

        // Execute with timeout
        const timeoutPromise = new Promise<never>((_, reject) =>
          setTimeout(() => reject(new Error('Task timeout')), this.config.taskTimeout)
        );

        const result = await Promise.race([
          agent.execute(enhancedTask),
          timeoutPromise,
        ]);

        // Update execution
        const finalExecution = this.taskExecutions.get(task.id);
        if (finalExecution) {
          finalExecution.endTime = Date.now();
          finalExecution.status = 'completed';
          finalExecution.result = result;
          // Preserve progress info from result metadata
          if (result.metadata?.iterations) {
            finalExecution.currentIteration = result.metadata.iterations as number;
          }
        }
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

  /**
   * Check for errors and fix them using the debugger agent
   */
  private async checkAndFixErrors(
    routingDecisions: RoutingDecision[],
    parentTaskId: string,
    maxIterations: number = 5
  ): Promise<AgentResult[]> {
    const errorFixResults: AgentResult[] = [];
    
    // Get the debugger agent
    const debuggerAgent = this.router.getAgent('debugger');
    if (!debuggerAgent) {
      console.warn('[MDAP Orchestrator] Debugger agent not available for error checking');
      return errorFixResults;
    }

    for (let iteration = 0; iteration < maxIterations; iteration++) {
      // Create a task for the debugger agent to check for errors
      const errorCheckTask: AgentTask = {
        id: `${parentTaskId}-error-check-${iteration + 1}`,
        prompt: `Check for TypeScript type errors, build errors, and runtime errors in the codebase. Use the check_type_errors tool to check for type errors, and get_console_logs to check for build and runtime errors. If any errors are found, report them in detail. If no errors are found, respond with "No errors found."`,
        metadata: {
          type: 'error_check',
          iteration: iteration + 1,
          parentTaskId,
        },
      };

      let hasErrors = false;
      let errorMessage = '';

      try {
        // Execute error checking task
        const checkResult = await this.executeTask(errorCheckTask, routingDecisions, errorCheckTask.prompt);
        
        // Parse the result to see if errors were found
        const output = checkResult.output.toLowerCase();
        if (output.includes('no errors found') || 
            output.includes('no type errors') ||
            output.includes('no build errors') ||
            output.includes('no runtime errors')) {
          // No errors found, we're done
          break;
        }

        // If the output contains error information, extract it
        if (output.includes('error') || output.includes('failed') || output.includes('cannot')) {
          hasErrors = true;
          errorMessage = checkResult.output;
        }
      } catch (error) {
        console.warn('[MDAP Orchestrator] Error during error checking:', error);
        // Continue even if error checking fails
        break;
      }

      if (!hasErrors) {
        // No errors found, we're done
        break;
      }

      // Create a task for the debugger agent to fix errors
      const errorFixTask: AgentTask = {
        id: `${parentTaskId}-error-fix-${iteration + 1}`,
        prompt: `⚠️ ERRORS DETECTED - Please fix the following issues:\n\n${errorMessage}\n\nPlease fix all these errors to ensure the application builds and runs correctly. Use the appropriate tools to fix type errors, build errors, and runtime errors.`,
        metadata: {
          type: 'error_fix',
          iteration: iteration + 1,
          parentTaskId,
        },
      };

      try {
        const fixResult = await this.executeTask(errorFixTask, routingDecisions, errorFixTask.prompt);
        errorFixResults.push(fixResult);
        console.log(`[MDAP Orchestrator] Error fix iteration ${iteration + 1} completed`);
      } catch (error) {
        console.error(`[MDAP Orchestrator] Error fix iteration ${iteration + 1} failed:`, error);
        // Stop trying if execution fails
        break;
      }
    }

    return errorFixResults;
  }

  /**
   * Add artifact to registry and persist via sink if provided
   */
  private async addArtifact(artifact: Partial<Artifact> & { filename: string; content: string }): Promise<Artifact> {
    const saved = this.artifactRegistry.addOrUpdate(artifact);
    if (this.artifactSink) {
      try {
        await this.artifactSink(saved);
      } catch (error) {
        console.warn('[MDAP Orchestrator] Failed to persist artifact:', error);
      }
    }
    return saved;
  }
}

/**
 * Create an MDAP orchestrator
 */
export function createOrchestrator(config: OrchestratorConfig): MDAPOrchestrator {
  return new MDAPOrchestrator(config);
}
