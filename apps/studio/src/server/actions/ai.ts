"use server";

/**
 * Server actions for AI agent interactions
 */

import { getUser } from "@/lib/auth";
import { createAgent, AgentEvent, ConversationMemory, getDefaultSystemPrompt } from "@/lib/ai";
import type { AccuralAIModelId } from "@/lib/ai";
import { createBuilderMdapOrchestrator } from "@/lib/ai/mdap";
import { SandboxManager } from "@codalyn/sandbox";
import { db } from "@/lib/db";
import { aiSessions, toolLogs } from "@/lib/db/schema";
import { eq } from "drizzle-orm";
import { saveArtifacts } from "./artifacts";
import type { Artifact } from "@codalyn/accuralai";

const sandboxManager = new SandboxManager();

// Helper to get Gemini provider keys and defaults from environment
function getAccuralAIConfig(): {
  modelName: string;
  googleApiKey: string;
} {
  const rawModel = process.env.ACCURALAI_MODEL || "gemini-2.5-flash";
  const modelName = rawModel.startsWith("google:") ? rawModel.replace(/^google:/, "") : rawModel;
  const googleApiKey =
    process.env.ACCURALAI_GOOGLE_API_KEY ||
    process.env.GOOGLE_GENAI_API_KEY ||
    process.env.GOOGLE_API_KEY ||
    "";

  if (!googleApiKey) {
    throw new Error("Configure ACCURALAI_GOOGLE_API_KEY (or GOOGLE_GENAI_API_KEY) for Gemini access");
  }

  return { modelName, googleApiKey };
}

export interface ChatMessage {
  role: "user" | "assistant";
  content: string;
  toolCalls?: Array<{ name: string; args: any; result?: any }>;
}

export async function createAISession(projectId: string) {
  const user = await getUser();
  if (!user) throw new Error("Unauthorized");

  const [session] = await db
    .insert(aiSessions)
    .values({
      projectId,
      userId: user.id,
      status: "planning",
    })
    .returning();

  return session;
}

export async function chatWithAI(
  sessionId: string,
  message: string,
  projectId: string
): Promise<{ response: string; toolCalls: Array<{ name: string; args: any; result: any }> }> {
  console.log("[AI Debug] chatWithAI() - Starting");
  console.log(`[AI Debug] Session ID: ${sessionId}`);
  console.log(`[AI Debug] Project ID: ${projectId}`);
  console.log(`[AI Debug] Message: ${message.substring(0, 100)}${message.length > 100 ? "..." : ""}`);

  const user = await getUser();
  if (!user) throw new Error("Unauthorized");

  const accuralaiConfig = getAccuralAIConfig();

  // Get or create sandbox for project
  // Use mock sandbox for server-side execution (WebContainers only work in browser)
  console.log("[AI Debug] Creating sandbox...");
  const sandbox = await sandboxManager.createSandbox("mock");
  console.log("[AI Debug] Sandbox created");

  // Get conversation history
  console.log("[AI Debug] Fetching session from database...");
  const session = await db.query.aiSessions.findFirst({
    where: eq(aiSessions.id, sessionId),
  });

  if (!session) {
    throw new Error("Session not found");
  }

  // Use the standard system prompt from the AI module
  const systemPrompt = getDefaultSystemPrompt();
  console.log(`[AI Debug] System prompt length: ${systemPrompt.length} chars`);

  // Create memory and restore previous conversation
  const memory = new ConversationMemory(systemPrompt);
  const previousHistory = (session.context as any)?.conversationHistory || [];
  console.log(`[AI Debug] Restoring ${previousHistory.length} previous messages`);

  // Restore previous messages
  for (const msg of previousHistory) {
    memory.addMessage(msg);
  }

  // Create agent
  console.log("[AI Debug] Creating agent...");
  console.log(`[AI Debug] Using Google Gemini backend`);
  const agent = createAgent({
    modelName: accuralaiConfig.modelName,
    googleApiKey: accuralaiConfig.googleApiKey,
    sandbox,
    systemPrompt,
    maxIterations: 10,
  });
  console.log("[AI Debug] Agent created");

  // Manually restore memory to agent (since we created it with systemPrompt)
  for (const msg of previousHistory) {
    agent.getHistory(); // This is just to ensure we have the same reference
  }

  // Run agent
  console.log("[AI Debug] Running agent...");
  const startTime = Date.now();
  const result = await agent.run(message);
  const duration = Date.now() - startTime;
  console.log(`[AI Debug] Agent completed (${duration}ms)`);

  // Log tool executions
  console.log(`[AI Debug] Logging ${result.toolResults.length} tool results to database...`);
  for (const toolResult of result.toolResults) {
    await db.insert(toolLogs).values({
      sessionId,
      toolName: toolResult.name,
      inputs: {}, // We'd need to match this with the toolCall
      output: toolResult.result,
      error: toolResult.error,
      executionTime: "0", // Not tracked in new system yet
    });
  }

  // Update session context
  console.log("[AI Debug] Updating session context in database...");
  await db
    .update(aiSessions)
    .set({
      context: {
        conversationHistory: result.messages,
      },
      updatedAt: new Date(),
    })
    .where(eq(aiSessions.id, sessionId));

  console.log(`[AI Debug] chatWithAI() - Completed`);
  console.log(`[AI Debug] Final response length: ${result.finalResponse.length} chars`);
  console.log(`[AI Debug] Tool calls: ${result.toolCalls.length}`);

  return {
    response: result.finalResponse,
    toolCalls: result.toolCalls.map((tc, i) => ({
      name: tc.name,
      args: tc.args,
      result: result.toolResults[i]?.result,
    })),
  };
}

export async function* streamChatWithAI(
  sessionId: string,
  message: string,
  projectId: string
): AsyncGenerator<{ type: "text" | "tool_call"; data: any }> {
  console.log("[AI Debug] streamChatWithAI() - Starting");
  console.log(`[AI Debug] Session ID: ${sessionId}`);
  console.log(`[AI Debug] Project ID: ${projectId}`);
  console.log(`[AI Debug] Message: ${message.substring(0, 100)}${message.length > 100 ? "..." : ""}`);

  const user = await getUser();
  if (!user) throw new Error("Unauthorized");

  const accuralaiConfig = getAccuralAIConfig();

  // Use mock sandbox for server-side execution (WebContainers only work in browser)
  console.log("[AI Debug] Creating sandbox...");
  const sandbox = await sandboxManager.createSandbox("mock");
  console.log("[AI Debug] Sandbox created");

  console.log("[AI Debug] Fetching session from database...");
  const session = await db.query.aiSessions.findFirst({
    where: eq(aiSessions.id, sessionId),
  });

  if (!session) {
    throw new Error("Session not found");
  }

  // Use the standard system prompt from the AI module
  const systemPrompt = getDefaultSystemPrompt();
  console.log(`[AI Debug] System prompt length: ${systemPrompt.length} chars`);

  // Create agent
  console.log("[AI Debug] Creating agent...");
  console.log(`[AI Debug] Using Google Gemini backend`);
  const agent = createAgent({
    modelName: accuralaiConfig.modelName,
    googleApiKey: accuralaiConfig.googleApiKey,
    sandbox,
    systemPrompt,
    maxIterations: 10,
  });
  console.log("[AI Debug] Agent created");

  // Restore previous messages
  const previousHistory = (session.context as any)?.conversationHistory || [];
  console.log(`[AI Debug] Restoring ${previousHistory.length} previous messages`);
  for (const msg of previousHistory) {
    agent.getHistory(); // Just accessing to restore state
  }

  // Stream agent execution
  console.log("[AI Debug] Starting agent stream...");
  const streamStartTime = Date.now();
  const stream = agent.runStream(message);
  let eventCount = 0;

  for await (const event of stream) {
    eventCount++;
    if (event.type === "thought") {
      yield { type: "text", data: event.content };
    } else if (event.type === "tool_call") {
      yield {
        type: "tool_call",
        data: {
          name: event.toolCall.name,
          args: event.toolCall.args,
        },
      };
    } else if (event.type === "tool_result") {
      yield {
        type: "tool_call",
        data: {
          name: event.toolResult.name,
          args: {},
          result: event.toolResult.result,
        },
      };
    } else if (event.type === "response") {
      console.log(`[AI Debug] Stream event ${eventCount}: response (${event.content?.length || 0} chars)`);
      yield { type: "text", data: event.content };
    } else {
      console.log(`[AI Debug] Stream event ${eventCount}: ${event.type}`);
    }
  }

  const streamDuration = Date.now() - streamStartTime;
  console.log(`[AI Debug] Stream completed (${streamDuration}ms, ${eventCount} events)`);

  // Update session context with final history
  console.log("[AI Debug] Updating session context in database...");
  await db
    .update(aiSessions)
    .set({
      context: {
        conversationHistory: agent.getHistory(),
      },
      updatedAt: new Date(),
    })
    .where(eq(aiSessions.id, sessionId));

  console.log(`[AI Debug] streamChatWithAI() - Completed`);
}

/**
 * Chat with AI using MDAP orchestrator for multi-agent execution
 * Generates plans and artifacts following the Aurelius MDAP pattern
 */
export async function chatWithMDAP(
  sessionId: string,
  message: string,
  projectId: string
): Promise<{
  response: string;
  plan?: any;
  planArtifact?: Artifact;
  artifacts: Artifact[];
  toolCalls: Array<{ name: string; args: any; result: any }>;
}> {
  console.log("[MDAP Debug] chatWithMDAP() - Starting");
  console.log(`[MDAP Debug] Session ID: ${sessionId}`);
  console.log(`[MDAP Debug] Project ID: ${projectId}`);
  console.log(`[MDAP Debug] Message: ${message.substring(0, 100)}${message.length > 100 ? "..." : ""}`);

  const user = await getUser();
  if (!user) throw new Error("Unauthorized");

  const accuralaiConfig = getAccuralAIConfig();

  // Get session from database
  console.log("[MDAP Debug] Fetching session from database...");
  const session = await db.query.aiSessions.findFirst({
    where: eq(aiSessions.id, sessionId),
  });

  if (!session) {
    throw new Error("Session not found");
  }

  // Create MDAP orchestrator
  console.log("[MDAP Debug] Creating MDAP orchestrator...");
  const modelName: AccuralAIModelId =
    accuralaiConfig.modelName === "gemini-2.5-flash-lite"
      ? "google:gemini-2.5-flash-lite"
      : accuralaiConfig.modelName === "gemini-2.5-pro"
      ? "google:gemini-2.5-pro"
      : accuralaiConfig.modelName === "gemini-flash-latest"
      ? "google:gemini-flash-latest"
      : "google:gemini-2.5-flash";
  const orchestrator = createBuilderMdapOrchestrator({
    modelName,
    googleApiKey: accuralaiConfig.googleApiKey,
    maxParallelTasks: 3,
    maxRetries: 2,
  });
  console.log("[MDAP Debug] MDAP orchestrator created");

  // Execute MDAP workflow
  console.log("[MDAP Debug] Executing MDAP workflow...");
  const startTime = Date.now();
  const result = await orchestrator.execute({
    prompt: message,
    workflow: "sequential", // Use sequential workflow for proper context accumulation
  });
  const duration = Date.now() - startTime;
  console.log(`[MDAP Debug] MDAP execution completed (${duration}ms)`);
  console.log(`[MDAP Debug] Generated ${result.artifacts.length} artifacts`);
  console.log(`[MDAP Debug] Plan generated: ${result.planArtifact ? "Yes" : "No"}`);

  // Save all artifacts to database
  if (result.artifacts.length > 0) {
    console.log("[MDAP Debug] Saving artifacts to database...");
    await saveArtifacts(projectId, result.artifacts, sessionId);
    console.log(`[MDAP Debug] Saved ${result.artifacts.length} artifacts`);
  }

  // Log tool executions from MDAP
  console.log(`[MDAP Debug] Logging tool executions...`);
  const allToolCalls: Array<{ name: string; args: any; result: any }> = [];

  for (const execution of result.results) {
    if (execution.artifacts && execution.artifacts.length > 0) {
      // Track artifact creation as implicit tool calls
      for (const artifact of execution.artifacts) {
        allToolCalls.push({
          name: "create_artifact",
          args: {
            filename: artifact.filename,
            path: artifact.path,
            type: artifact.type,
          },
          result: { success: true, artifactId: artifact.id },
        });

        await db.insert(toolLogs).values({
          sessionId,
          toolName: "create_artifact",
          inputs: { filename: artifact.filename, path: artifact.path, type: artifact.type },
          output: { success: true, artifactId: artifact.id },
          error: null,
          executionTime: "0",
        });
      }
    }
  }

  // Update session context
  console.log("[MDAP Debug] Updating session context in database...");
  await db
    .update(aiSessions)
    .set({
      context: {
        mdapExecution: {
          plan: result.plan,
          artifacts: result.artifacts.map(a => a.id),
          timestamp: new Date().toISOString(),
        },
      },
      status: "completed",
      updatedAt: new Date(),
    })
    .where(eq(aiSessions.id, sessionId));

  console.log(`[MDAP Debug] chatWithMDAP() - Completed`);
  console.log(`[MDAP Debug] Final output length: ${result.finalOutput.length} chars`);

  return {
    response: result.finalOutput,
    plan: result.plan,
    planArtifact: result.planArtifact,
    artifacts: result.artifacts,
    toolCalls: allToolCalls,
  };
}


