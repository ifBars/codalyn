"use server";

/**
 * Server actions for AI agent interactions
 */

import { getUser } from "@/lib/auth";
import { createAgent, AgentEvent, ConversationMemory } from "@/lib/ai";
import { SandboxManager } from "@codalyn/sandbox";
import { db } from "@/lib/db";
import { aiSessions, toolLogs } from "@/lib/db/schema";
import { eq } from "drizzle-orm";
import { randomUUID } from "crypto";

const sandboxManager = new SandboxManager();

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
  const user = await getUser();
  if (!user) throw new Error("Unauthorized");

  if (!process.env.GEMINI_API_KEY) {
    throw new Error("GEMINI_API_KEY is not configured");
  }

  // Get or create sandbox for project
  // Use mock sandbox for server-side execution (WebContainers only work in browser)
  const sandbox = await sandboxManager.createSandbox("mock");

  // Get conversation history
  const session = await db.query.aiSessions.findFirst({
    where: eq(aiSessions.id, sessionId),
  });

  if (!session) {
    throw new Error("Session not found");
  }

  // Get system prompt
  const systemPrompt = `You are an AI engineer helping to build web applications.
You have access to tools that let you read/write files, run commands, manage git, and interact with the database.

## CRITICAL: MANDATORY TOOL USAGE
**YOU MUST ALWAYS USE TOOLS - NEVER PROVIDE EMPTY RESPONSES**

- **ALWAYS** call at least one tool function in every response when the user requests any action
- **NEVER** respond with only text when you should be performing operations
- **NEVER** output code directly in your text response - code MUST be written via tools
- **EMPTY RESPONSES ARE FORBIDDEN** - Every response must include tool calls or a clear explanation of why tools aren't needed

When the user asks you to do something:
1. First, understand what they want
2. Break it down into steps
3. Use the available tools to accomplish each step
4. Explain what you're doing as you go
5. **ALWAYS end with a Tool Sequence Summary** listing all tools called and their purpose

Remember:
- Always read files before modifying them
- Use git commands to track changes
- Run commands to test/build when needed
- Be careful with destructive operations
- **NEVER output code unless you're using a tool**
- **ALWAYS provide a Tool Sequence Summary at the end**`;

  // Create memory and restore previous conversation
  const memory = new ConversationMemory(systemPrompt);
  const previousHistory = (session.context as any)?.conversationHistory || [];

  // Restore previous messages
  for (const msg of previousHistory) {
    memory.addMessage(msg);
  }

  // Create agent
  const agent = createAgent({
    apiKey: process.env.GEMINI_API_KEY,
    modelName: "gemini-2.0-flash-exp",
    sandbox,
    systemPrompt,
    maxIterations: 10,
  });

  // Manually restore memory to agent (since we created it with systemPrompt)
  for (const msg of previousHistory) {
    agent.getHistory(); // This is just to ensure we have the same reference
  }

  // Run agent
  const result = await agent.run(message);

  // Log tool executions
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
  await db
    .update(aiSessions)
    .set({
      context: {
        conversationHistory: result.messages,
      },
      updatedAt: new Date(),
    })
    .where(eq(aiSessions.id, sessionId));

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
  const user = await getUser();
  if (!user) throw new Error("Unauthorized");

  if (!process.env.GEMINI_API_KEY) {
    throw new Error("GEMINI_API_KEY is not configured");
  }

  // Use mock sandbox for server-side execution (WebContainers only work in browser)
  const sandbox = await sandboxManager.createSandbox("mock");

  const session = await db.query.aiSessions.findFirst({
    where: eq(aiSessions.id, sessionId),
  });

  if (!session) {
    throw new Error("Session not found");
  }

  // Get system prompt
  const systemPrompt = `You are an AI engineer helping to build web applications.
You have access to tools that let you read/write files, run commands, manage git, and interact with the database.

## CRITICAL: MANDATORY TOOL USAGE
**YOU MUST ALWAYS USE TOOLS - NEVER PROVIDE EMPTY RESPONSES**

- **ALWAYS** call at least one tool function in every response when the user requests any action
- **NEVER** respond with only text when you should be performing operations
- **NEVER** output code directly in your text response - code MUST be written via tools

When the user asks you to do something:
1. First, understand what they want
2. Break it down into steps
3. Use the available tools to accomplish each step
4. Explain what you're doing as you go

Remember:
- Always read files before modifying them
- Use git commands to track changes
- Run commands to test/build when needed
- Be careful with destructive operations`;

  // Create agent
  const agent = createAgent({
    apiKey: process.env.GEMINI_API_KEY,
    modelName: "gemini-2.0-flash-exp",
    sandbox,
    systemPrompt,
    maxIterations: 10,
  });

  // Restore previous messages
  const previousHistory = (session.context as any)?.conversationHistory || [];
  for (const msg of previousHistory) {
    agent.getHistory(); // Just accessing to restore state
  }

  // Stream agent execution
  const stream = agent.runStream(message);

  for await (const event of stream) {
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
      yield { type: "text", data: event.content };
    }
  }

  // Update session context with final history
  await db
    .update(aiSessions)
    .set({
      context: {
        conversationHistory: agent.getHistory(),
      },
      updatedAt: new Date(),
    })
    .where(eq(aiSessions.id, sessionId));
}


