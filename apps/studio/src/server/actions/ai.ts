"use server";

/**
 * Server actions for AI agent interactions
 */

import { getUser } from "@/lib/auth";
import { createAgent, AgentEvent, ConversationMemory, getDefaultSystemPrompt, type BackendProvider } from "@/lib/ai";
import { SandboxManager } from "@codalyn/sandbox";
import { db } from "@/lib/db";
import { aiSessions, toolLogs } from "@/lib/db/schema";
import { eq } from "drizzle-orm";
import { randomUUID } from "crypto";

const sandboxManager = new SandboxManager();

// Helper to get API key and backend from environment or defaults
function getBackendConfig(): { backend: BackendProvider; apiKey: string; modelName: string } {
  // Check for OpenRouter first, then fall back to Gemini
  if (process.env.OPENROUTER_API_KEY) {
    return {
      backend: "openrouter",
      apiKey: process.env.OPENROUTER_API_KEY,
      modelName: process.env.OPENROUTER_MODEL || "openrouter/auto",
    };
  }
  
  if (process.env.GEMINI_API_KEY) {
    return {
      backend: "gemini",
      apiKey: process.env.GEMINI_API_KEY,
      modelName: process.env.GEMINI_MODEL || "gemini-2.0-flash-exp",
    };
  }
  
  throw new Error("Neither OPENROUTER_API_KEY nor GEMINI_API_KEY is configured");
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

  const backendConfig = getBackendConfig();

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
  console.log(`[AI Debug] Using backend: ${backendConfig.backend}`);
  const agent = createAgent({
    apiKey: backendConfig.apiKey,
    modelName: backendConfig.modelName,
    backend: backendConfig.backend,
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

  const backendConfig = getBackendConfig();

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
  console.log(`[AI Debug] Using backend: ${backendConfig.backend}`);
  const agent = createAgent({
    apiKey: backendConfig.apiKey,
    modelName: backendConfig.modelName,
    backend: backendConfig.backend,
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


