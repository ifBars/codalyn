/**
 * MDAP (Multi-Dimensional Agent Protocol) - Multi-agent orchestration
 */

export {
  Agent,
  createAgent,
  type AgentConfig,
  type AgentTask,
  type AgentResult,
} from './agent';

export {
  SubAgent,
  createSubAgent,
  SubAgentPresets,
  type SubAgentConfig,
  type SubAgentCapability,
} from './sub-agent';

export {
  TaskRouter,
  createTaskRouter,
  RoutingRulePresets,
  type TaskRouterConfig,
  type RoutingRule,
  type RoutingDecision,
} from './task-router';

export {
  MDAPOrchestrator,
  createOrchestrator,
  type OrchestratorConfig,
  type OrchestratorTask,
  type OrchestratorResult,
  type WorkflowMode,
  type TaskExecution,
  type DecomposedPlan,
} from './orchestrator';

export {
  ArtifactRegistry,
  createArtifactRegistry,
  ArtifactHelpers,
  ArtifactSchema,
  type Artifact,
  type ArtifactType,
  type ArtifactMetadata,
} from './artifacts';
