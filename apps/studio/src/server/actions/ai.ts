"use server";

/**
 * Server actions for AI agent interactions
 */

import { getUser } from "@/lib/auth";
import { chatWithAgent, streamChatWithAgent } from "@/lib/gemini";
import { getExecutor } from "@codalyn/tools";
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

  // Call AI with tool calling
  const { response, toolCalls } = await chatWithAgent(message, {
    conversationHistory: session.context as any,
  });

  // Execute tool calls
  const executedToolCalls = [];
  for (const toolCall of toolCalls) {
    const executor = getExecutor(toolCall.name);
    if (!executor) {
      executedToolCalls.push({
        name: toolCall.name,
        args: toolCall.args,
        result: { error: "Tool executor not found" },
      });
      continue;
    }

    const startTime = Date.now();
    try {
      const result = await executor.execute(toolCall.args, sandbox);
      const executionTime = Date.now() - startTime;

      // Log tool execution
      await db.insert(toolLogs).values({
        sessionId,
        toolName: toolCall.name,
        inputs: toolCall.args,
        output: result.output,
        error: result.error,
        executionTime: executionTime.toString(),
      });

      executedToolCalls.push({
        name: toolCall.name,
        args: toolCall.args,
        result: result.output,
      });
    } catch (error) {
      executedToolCalls.push({
        name: toolCall.name,
        args: toolCall.args,
        result: { error: error instanceof Error ? error.message : "Unknown error" },
      });
    }
  }

  // Update session context
  await db
    .update(aiSessions)
    .set({
      context: {
        conversationHistory: [
          ...((session.context as any)?.conversationHistory || []),
          { role: "user", content: message },
          { role: "assistant", content: response, toolCalls: executedToolCalls },
        ],
      },
      updatedAt: new Date(),
    })
    .where(eq(aiSessions.id, sessionId));

  return {
    response,
    toolCalls: executedToolCalls,
  };
}

export async function* streamChatWithAI(
  sessionId: string,
  message: string,
  projectId: string
): AsyncGenerator<{ type: "text" | "tool_call"; data: any }> {
  const user = await getUser();
  if (!user) throw new Error("Unauthorized");

  // Use mock sandbox for server-side execution (WebContainers only work in browser)
  const sandbox = await sandboxManager.createSandbox("mock");

  const session = await db.query.aiSessions.findFirst({
    where: eq(aiSessions.id, sessionId),
  });

  if (!session) {
    throw new Error("Session not found");
  }

  // Stream AI response
  const stream = streamChatWithAgent(message, {
    conversationHistory: session.context as any,
  });

  for await (const chunk of stream) {
    if (typeof chunk === "string") {
      yield { type: "text", data: chunk };
    } else {
      // Tool call - execute it
      const executor = getExecutor(chunk.name);
      if (executor) {
        try {
          const result = await executor.execute(chunk.args, sandbox);
          yield {
            type: "tool_call",
            data: {
              name: chunk.name,
              args: chunk.args,
              result: result.output,
            },
          };
        } catch (error) {
          yield {
            type: "tool_call",
            data: {
              name: chunk.name,
              args: chunk.args,
              result: { error: error instanceof Error ? error.message : "Unknown error" },
            },
          };
        }
      }
    }
  }
}

