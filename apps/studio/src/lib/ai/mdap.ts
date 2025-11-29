import {
  MDAPOrchestrator,
  createTaskRouter,
  RoutingRulePresets,
  SubAgent,
  SubAgentPresets,
  createAgent as createMdapAgent,
  createVercelAIBackend,
  type Artifact,
} from "@codalyn/accuralai";
import type { AccuralAIModelId } from "./core/types";
import { WebContainerSandbox } from "./sandbox/webcontainer-sandbox";
import { CodalynToolSet } from "./tools";
import { BrowserToolSet, CompositeToolSet } from "./index";

export interface MdapOrchestratorConfig {
  modelName?: AccuralAIModelId;
  googleApiKey?: string;
  openRouterApiKey?: string;
  openRouterSite?: string;
  openRouterTitle?: string;
  anthropicApiKey?: string;
  maxParallelTasks?: number;
  maxRetries?: number;
}

/**
 * Build a prewired MDAP orchestrator aligned with the MDAP/MAKER plan:
 * - Rule-based router covering codegen, testing, review, design, debugging, and architecture.
 * - Specialized sub-agents with conservative temperatures and short max tokens.
 * - Vercel AI backend so any provider key can be dropped in.
 */
export function createBuilderMdapOrchestrator(config: MdapOrchestratorConfig): MDAPOrchestrator {
  const backend = createVercelAIBackend({
    defaultModel: config.modelName || "google:gemini-2.5-flash",
    google: config.googleApiKey ? { apiKey: config.googleApiKey } : undefined,
    openai: config.openRouterApiKey
      ? {
          apiKey: config.openRouterApiKey,
          baseURL: "https://openrouter.ai/api/v1",
          headers: {
            "HTTP-Referer": config.openRouterSite || "",
            "X-Title": config.openRouterTitle || "Codalyn",
          },
        }
      : undefined,
    anthropic: config.anthropicApiKey ? { apiKey: config.anthropicApiKey } : undefined,
  });

  // Create sandbox and tools that all agents will share
  const sandbox = new WebContainerSandbox();
  const codalynTools = new CodalynToolSet(sandbox);
  const browserTools = new BrowserToolSet();
  const tools = new CompositeToolSet([codalynTools, browserTools]);
  // Ensure plans directory exists for artifact persistence
  sandbox.mkdir("plans", { recursive: true }).catch(() => {});

  const artifactSink = async (artifact: Artifact) => {
    try {
      const pathParts = artifact.path.split("/");
      pathParts.pop(); // remove filename
      let dir = "";
      for (const part of pathParts) {
        if (!part) continue;
        dir = dir ? `${dir}/${part}` : part;
        try {
          await sandbox.mkdir(dir, { recursive: true });
        } catch (err) {
          // ignore mkdir errors (likely already exists)
        }
      }
      await sandbox.writeFile(artifact.path, artifact.content);
    } catch (error) {
      console.warn("[Builder MDAP] Failed to persist artifact to sandbox:", error);
    }
  };

  // Core sub-agents with QA and Finalizer for proper MDAP workflow
  // Following the Aurelius pattern: specialized agents + mandatory QA + Finalizer
  // Each agent gets access to the full tool set for file operations
  const agents: SubAgent[] = [
    new SubAgent({ ...SubAgentPresets.codeGenerator(backend), tools }),
    new SubAgent({ ...SubAgentPresets.reviewer(backend), tools }),
    new SubAgent({ ...SubAgentPresets.tester(backend), tools }),
    new SubAgent({ ...SubAgentPresets.designer(backend), tools }),
    new SubAgent({ ...SubAgentPresets.debugger(backend), tools }),
    new SubAgent({ ...SubAgentPresets.architect(backend), tools }),
    new SubAgent({ ...SubAgentPresets.qualityAssurance(backend), tools }),
    new SubAgent({ ...SubAgentPresets.finalizer(backend), tools }),
  ];

  // Router seeded with common routing rules from the MDAP plan
  const router = createTaskRouter({
    rules: [
      RoutingRulePresets.codeGeneration,
      RoutingRulePresets.testing,
      RoutingRulePresets.codeReview,
      RoutingRulePresets.design,
      RoutingRulePresets.debugging,
      RoutingRulePresets.architecture,
      RoutingRulePresets.qualityAssurance,
      RoutingRulePresets.finalization,
    ],
    fallbackToLeastLoaded: true,
  });

  agents.forEach(agent => router.registerAgent(agent));

  // Optional main agent that can decompose tasks; uses same backend with a neutral prompt.
  const mainAgent = createMdapAgent({
    id: "planner",
    metadata: {},
    backend,
    role: "planner",
    systemPrompt:
      "You are a planning agent that decomposes complex web-app builder tasks into atomic subtasks.",
    temperature: 0.2,
    maxTokens: 1024,
    maxIterations: 10,
  });

  return new MDAPOrchestrator({
    mainAgent,
    router,
    maxParallelTasks: config.maxParallelTasks ?? 3,
    taskTimeout: 300000,
    maxRetries: config.maxRetries ?? 1,
    retryFailedTasks: true,
    generatePlanArtifact: true, // Generate markdown plan for studio viewing
    artifactSink,
  });
}
