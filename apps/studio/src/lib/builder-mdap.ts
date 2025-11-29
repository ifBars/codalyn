/**
 * Client-side MDAP integration for the builder
 * Uses AccuralAI MDAP orchestrator in the browser
 */

import { createBuilderMdapOrchestrator } from "./ai/mdap";
import type { Artifact, OrchestratorResult } from "@codalyn/accuralai";
import type { AccuralAIModelId } from "./ai/core/types";
import type { MdapProgressUpdate } from "@/components/builder/mdap-progress";

export interface BuilderMdapConfig {
  googleApiKey: string;
  modelName?: AccuralAIModelId;
  onProgress?: (update: MdapProgressUpdate) => void;
}

/**
 * Execute MDAP orchestration in the browser with real-time progress tracking
 * This runs the multi-agent workflow client-side
 */
export async function executeMdapInBrowser(
  prompt: string,
  config: BuilderMdapConfig
): Promise<OrchestratorResult> {
  const { onProgress } = config;

  console.log("[Builder MDAP] Creating orchestrator...");

  const modelName: AccuralAIModelId = config.modelName ?? "google:gemini-2.5-flash";

  const orchestrator = createBuilderMdapOrchestrator({
    modelName,
    googleApiKey: config.googleApiKey,
    maxParallelTasks: 2,
    maxRetries: 1,
  });

  console.log("[Builder MDAP] Executing workflow...");
  const startTime = Date.now();

  // Report initial planning stage
  onProgress?.({
    stage: "planning",
    message: "Initializing MDAP system...",
  });

  // Set up real-time progress polling
  let pollInterval: NodeJS.Timeout | null = null;
  let lastExecutionCount = 0;
  let currentStage: "planning" | "executing" | "qa" | "finalizing" | "complete" = "planning";
  let decomposedPlan: any = null; // Will store the decomposed plan once available

  const startProgressPolling = () => {
    pollInterval = setInterval(() => {
      const stats = orchestrator.getStats();
      const { executions, activeTasks, routerStats } = stats;

      // Update progress based on execution state
      if (executions.length === 0 && activeTasks === 0) {
        // Still planning
        if (currentStage !== "planning") {
          currentStage = "planning";
          onProgress?.({
            stage: "planning",
            message: "Decomposing task into subtasks...",
          });
        }
      } else {
        // Check if we're in execution phase
        const hasRunningTasks = executions.some(e => e.status === "running");
        const hasCompletedTasks = executions.some(e => e.status === "completed");
        const allCompleted = executions.length > 0 && executions.every(e => e.status === "completed" || e.status === "failed");

        // Determine stage based on agent roles
        const qaAgentLoad = routerStats.agents.find(a => a.id === "qa-agent")?.load.active ?? 0;
        const finalizerLoad = routerStats.agents.find(a => a.id === "finalizer")?.load.active ?? 0;
        const qaAgentActive = executions.some(e => e.status === "running" && e.agentId === "qa-agent") || qaAgentLoad > 0;
        const finalizerActive = executions.some(e => e.status === "running" && e.agentId === "finalizer") || finalizerLoad > 0;

        if (finalizerActive) {
          currentStage = "finalizing";
        } else if (qaAgentActive) {
          currentStage = "qa";
        } else if (hasRunningTasks || !allCompleted) {
          currentStage = "executing";
        }

        // Map executions to agent activities
        // Group by agentId to show each agent only once with latest status
        const agentActivityMap = new Map<string, any>();

        // First, count tasks per agent
        const agentTaskCounts = new Map<string, { running: number; completed: number; failed: number }>();
        executions.forEach(exec => {
          const counts = agentTaskCounts.get(exec.agentId) || { running: 0, completed: 0, failed: 0 };
          if (exec.status === "running") counts.running++;
          else if (exec.status === "completed") counts.completed++;
          else if (exec.status === "failed") counts.failed++;
          agentTaskCounts.set(exec.agentId, counts);
        });

        executions.forEach(exec => {
          const agentNameMap: Record<string, string> = {
            "code-generator": "Code Generator",
            "tester": "Test Engineer",
            "code-reviewer": "Code Reviewer",
            "ui-designer": "UI Designer",
            "debugger": "Debugger",
            "architect": "Software Architect",
            "qa-agent": "Quality Assurance",
            "finalizer": "Finalizer",
            "planner": "Planning Agent",
          };

          // Get task description based on counts
          const counts = agentTaskCounts.get(exec.agentId);
          let taskDescription: string | undefined;

          if (exec.status === "running") {
            if (counts && counts.completed > 0) {
              taskDescription = `Working (${counts.completed} completed)`;
            } else {
              taskDescription = "Working on task...";
            }
          } else if (exec.status === "completed") {
            if (counts && counts.completed > 1) {
              taskDescription = `${counts.completed} tasks completed`;
            } else {
              taskDescription = "Task completed";
            }
          }

          const activity = {
            agentId: exec.agentId,
            agentName: agentNameMap[exec.agentId] || exec.agentId,
            status: exec.status === "running" ? "working" as const :
                    exec.status === "completed" ? "completed" as const :
                    exec.status === "failed" ? "error" as const :
                    "idle" as const,
            task: taskDescription,
            startedAt: exec.startTime,
          };

          // Keep the most recent status (running > completed > idle)
          const existing = agentActivityMap.get(exec.agentId);
          if (!existing || activity.status === "working" || (existing.status !== "working" && activity.startedAt > existing.startedAt)) {
            agentActivityMap.set(exec.agentId, activity);
          }
        });

        const agentActivity = Array.from(agentActivityMap.values());

        // Only send updates when state changes
        if (executions.length !== lastExecutionCount || hasRunningTasks) {
          lastExecutionCount = executions.length;

          const runningAgents = agentActivity.filter(a => a.status === "working");
          const completedAgents = agentActivity.filter(a => a.status === "completed");

          let message = "";
          if (currentStage === "qa") {
            message = "Quality assurance in progress...";
          } else if (currentStage === "finalizing") {
            message = "Finalizing outputs and artifacts...";
          } else if (runningAgents.length > 0) {
            message = `${runningAgents.length} agent(s) working, ${completedAgents.length} completed`;
          } else if (allCompleted) {
            message = "All agents completed";
          }

          onProgress?.({
            stage: currentStage,
            message,
            agentActivity,
          });
        }
      }
    }, 300); // Poll every 300ms for smooth updates
  };

  // Start polling
  startProgressPolling();

  try {
    // Execute the workflow
    const result = await orchestrator.execute({
      prompt,
      workflow: "sequential",
    });

    const duration = Date.now() - startTime;
    console.log(`[Builder MDAP] Completed in ${duration}ms`);
    console.log(`[Builder MDAP] Generated ${result.artifacts.length} artifacts`);
    console.log(`[Builder MDAP] Plan: ${result.planArtifact ? "Yes" : "No"}`);

    // Stop polling
    if (pollInterval) {
      clearInterval(pollInterval);
    }

    // Report final completion with all agents shown as completed
    const finalStats = orchestrator.getStats();
    const finalAgentActivity = finalStats.executions.map(exec => {
      const agentNameMap: Record<string, string> = {
        "code-generator": "Code Generator",
        "tester": "Test Engineer",
        "code-reviewer": "Code Reviewer",
        "ui-designer": "UI Designer",
        "debugger": "Debugger",
        "architect": "Software Architect",
        "qa-agent": "Quality Assurance",
        "finalizer": "Finalizer",
        "planner": "Planning Agent",
      };

      return {
        agentId: exec.agentId,
        agentName: agentNameMap[exec.agentId] || exec.agentId,
        status: "completed" as const,
        startedAt: exec.startTime,
      };
    });

    onProgress?.({
      stage: "complete",
      message: `Completed in ${Math.floor(duration / 1000)}s - Generated ${result.artifacts.length} artifacts`,
      agentActivity: finalAgentActivity,
    });

    return result;
  } catch (error) {
    // Stop polling on error
    if (pollInterval) {
      clearInterval(pollInterval);
    }
    throw error;
  }
}

/**
 * Store artifacts in localStorage for a project
 */
export function saveArtifactsToLocalStorage(
  projectId: string,
  artifacts: Artifact[]
): void {
  const storageKey = `codalyn.mdap.artifacts.${projectId}`;

  try {
    const existing = getArtifactsFromLocalStorage(projectId);

    // Merge new artifacts with existing, removing duplicates by ID
    // New artifacts take precedence over existing ones with the same ID
    const artifactMap = new Map<string, Artifact>();

    // First add existing artifacts
    existing.forEach(artifact => {
      artifactMap.set(artifact.id, artifact);
    });

    // Then add/update with new artifacts (overwrites duplicates)
    artifacts.forEach(artifact => {
      artifactMap.set(artifact.id, artifact);
    });

    // Convert map back to array, sorted by creation date (newest first)
    const updated = Array.from(artifactMap.values()).sort((a, b) => {
      const dateA = a.metadata?.createdAt ? new Date(a.metadata.createdAt).getTime() : 0;
      const dateB = b.metadata?.createdAt ? new Date(b.metadata.createdAt).getTime() : 0;
      return dateB - dateA; // Newest first
    });

    // Keep only last 50 artifacts to avoid localStorage limits
    const limited = updated.slice(0, 50);

    localStorage.setItem(storageKey, JSON.stringify(limited));
    console.log(`[Builder MDAP] Saved ${artifacts.length} artifacts to localStorage (${updated.length} total, ${limited.length} kept)`);
  } catch (error) {
    console.error("[Builder MDAP] Failed to save artifacts:", error);
  }
}

/**
 * Retrieve artifacts from localStorage for a project
 */
export function getArtifactsFromLocalStorage(projectId: string): Artifact[] {
  const storageKey = `codalyn.mdap.artifacts.${projectId}`;

  try {
    const stored = localStorage.getItem(storageKey);
    if (!stored) return [];

    const parsed = JSON.parse(stored);

    // Convert date strings back to Date objects
    return parsed.map((artifact: any) => ({
      ...artifact,
      metadata: {
        ...artifact.metadata,
        createdAt: artifact.metadata?.createdAt
          ? new Date(artifact.metadata.createdAt)
          : undefined,
        updatedAt: artifact.metadata?.updatedAt
          ? new Date(artifact.metadata.updatedAt)
          : undefined,
      },
    }));
  } catch (error) {
    console.error("[Builder MDAP] Failed to load artifacts:", error);
    return [];
  }
}

/**
 * Get plan artifacts only
 */
export function getPlansFromLocalStorage(projectId: string): Artifact[] {
  const artifacts = getArtifactsFromLocalStorage(projectId);
  return artifacts.filter((a) => a.type === "plan");
}

/**
 * Delete a specific artifact by ID from localStorage
 */
export function deleteArtifactFromLocalStorage(projectId: string, artifactId: string): boolean {
  const storageKey = `codalyn.mdap.artifacts.${projectId}`;

  try {
    const artifacts = getArtifactsFromLocalStorage(projectId);
    const filtered = artifacts.filter(a => a.id !== artifactId);
    
    if (filtered.length === artifacts.length) {
      // Artifact not found
      return false;
    }

    localStorage.setItem(storageKey, JSON.stringify(filtered));
    console.log(`[Builder MDAP] Deleted artifact ${artifactId} from localStorage`);
    return true;
  } catch (error) {
    console.error("[Builder MDAP] Failed to delete artifact:", error);
    return false;
  }
}

/**
 * Clear all artifacts for a project
 */
export function clearArtifactsFromLocalStorage(projectId: string): void {
  const storageKey = `codalyn.mdap.artifacts.${projectId}`;
  localStorage.removeItem(storageKey);
  console.log(`[Builder MDAP] Cleared artifacts for project ${projectId}`);
}
