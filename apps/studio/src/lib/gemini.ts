/**
 * Gemini API client with tool calling support
 */

import { GoogleGenerativeAI, GenerativeModel } from "@google/generative-ai";
import { toolRegistry } from "@codalyn/tools";

if (!process.env.GEMINI_API_KEY) {
  throw new Error("GEMINI_API_KEY is not set");
}

export const gemini = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);

export interface ToolCall {
  name: string;
  args: Record<string, any>;
}

export interface ToolResult {
  toolCallId: string;
  name: string;
  result: any;
}

/**
 * Create a model with tool definitions
 */
export function createModelWithTools(modelName: string = "gemini-2.5-flash-lite"): GenerativeModel {
  const model = gemini.getGenerativeModel({ model: modelName });

  // Convert tool definitions to Gemini function declarations
  const functionDeclarations = toolRegistry.map((tool) => ({
    name: tool.name,
    description: tool.description,
    parameters: tool.parameters,
  }));

  return model;
}

/**
 * Chat with AI agent that can call tools
 */
/**
 * Chat with AI agent that can call tools
 */
export async function chatWithAgent(
  userMessage: string | null,
  context?: {
    conversationHistory?: Array<{ role: "user" | "assistant"; content: string; toolCalls?: any[] }>;
    projectFiles?: Record<string, string>;
    currentDiff?: string;
  }
): Promise<{
  response: string;
  toolCalls: ToolCall[];
}> {
  const model = createModelWithTools();

  // Build system prompt
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

Current project context:
${context?.projectFiles ? `Project files: ${Object.keys(context.projectFiles).join(", ")}` : ""}
${context?.currentDiff ? `Current changes:\n${context.currentDiff}` : ""}

Remember:
- Always read files before modifying them
- Use git commands to track changes
- Run commands to test/build when needed
- Be careful with destructive operations
- **NEVER output code unless you're using a tool**
- **ALWAYS provide a Tool Sequence Summary at the end**`;

  // Build conversation history
  const conversationParts: any[] = [
    { role: "user", parts: [{ text: systemPrompt }] },
  ];

  if (context?.conversationHistory) {
    for (const msg of context.conversationHistory) {
      if (msg.role === "assistant" && msg.toolCalls && msg.toolCalls.length > 0) {
        // Handle assistant message with tool calls
        const modelParts: any[] = [];
        if (msg.content) {
          modelParts.push({ text: msg.content });
        }

        // Add function calls
        for (const toolCall of msg.toolCalls) {
          modelParts.push({
            functionCall: {
              name: toolCall.name,
              args: toolCall.args,
            },
          });
        }

        conversationParts.push({
          role: "model",
          parts: modelParts,
        });

        // Add function responses
        const functionParts: any[] = [];
        for (const toolCall of msg.toolCalls) {
          if (toolCall.result) {
            functionParts.push({
              functionResponse: {
                name: toolCall.name,
                response: { name: toolCall.name, content: toolCall.result },
              },
            });
          }
        }

        if (functionParts.length > 0) {
          conversationParts.push({
            role: "function",
            parts: functionParts,
          });
        }
      } else {
        // Standard message
        conversationParts.push({
          role: msg.role === "user" ? "user" : "model",
          parts: [{ text: msg.content || "" }],
        });
      }
    }
  }

  if (userMessage) {
    conversationParts.push({
      role: "user",
      parts: [{ text: userMessage }],
    });
  }

  const result = await model.generateContent({
    contents: conversationParts as any,
    tools: [{
      functionDeclarations: toolRegistry.map((tool) => ({
        name: tool.name,
        description: tool.description,
        parameters: tool.parameters,
      }))
    }],
  });

  const response = await result.response;

  // Extract tool calls first
  const toolCalls: ToolCall[] = [];
  const functionCalls = response.functionCalls();

  // Extract text safely - only get text if there are text parts
  let text = "";
  try {
    const candidates = response.candidates;
    if (candidates && candidates[0]?.content?.parts) {
      const textParts = candidates[0].content.parts.filter((part: any) => part.text);
      text = textParts.map((part: any) => part.text).join("");
    }
  } catch (e) {
    // If extraction fails, text remains empty
  }
  if (functionCalls) {
    for (const call of functionCalls) {
      toolCalls.push({
        name: call.name,
        args: call.args as Record<string, any>,
      });
    }
  }

  return {
    response: text,
    toolCalls,
  };
}

/**
 * Stream chat response
 */
/**
 * Stream chat response
 */
export async function* streamChatWithAgent(
  userMessage: string | null,
  context?: {
    conversationHistory?: Array<{ role: "user" | "assistant"; content: string; toolCalls?: any[] }>;
    projectFiles?: Record<string, string>;
  }
): AsyncGenerator<string | ToolCall> {
  const model = createModelWithTools();

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
- **NEVER output code unless you're using a tool**
- **ALWAYS provide a Tool Sequence Summary at the end**`;

  const conversationParts: any[] = [
    { role: "user", parts: [{ text: systemPrompt }] },
  ];

  if (context?.conversationHistory) {
    for (const msg of context.conversationHistory) {
      if (msg.role === "assistant" && msg.toolCalls && msg.toolCalls.length > 0) {
        // Handle assistant message with tool calls
        const modelParts: any[] = [];
        if (msg.content) {
          modelParts.push({ text: msg.content });
        }

        // Add function calls
        for (const toolCall of msg.toolCalls) {
          modelParts.push({
            functionCall: {
              name: toolCall.name,
              args: toolCall.args,
            },
          });
        }

        conversationParts.push({
          role: "model",
          parts: modelParts,
        });

        // Add function responses
        const functionParts: any[] = [];
        for (const toolCall of msg.toolCalls) {
          if (toolCall.result) {
            functionParts.push({
              functionResponse: {
                name: toolCall.name,
                response: { name: toolCall.name, content: toolCall.result },
              },
            });
          }
        }

        if (functionParts.length > 0) {
          conversationParts.push({
            role: "function",
            parts: functionParts,
          });
        }
      } else {
        // Standard message
        conversationParts.push({
          role: msg.role === "user" ? "user" : "model",
          parts: [{ text: msg.content || "" }],
        });
      }
    }
  }

  if (userMessage) {
    conversationParts.push({
      role: "user",
      parts: [{ text: userMessage }],
    });
  }

  const result = await model.generateContentStream({
    contents: conversationParts as any,
    tools: [{
      functionDeclarations: toolRegistry.map((tool) => ({
        name: tool.name,
        description: tool.description,
        parameters: tool.parameters,
      }))
    }],
  });

  for await (const chunk of result.stream) {
    // Extract text safely
    let text = "";
    try {
      const candidates = chunk.candidates;
      if (candidates && candidates[0]?.content?.parts) {
        const textParts = candidates[0].content.parts.filter((part: any) => part.text);
        text = textParts.map((part: any) => part.text).join("");
      }
    } catch (e) {
      // If extraction fails, text remains empty
    }

    if (text) {
      yield text;
    }

    const functionCalls = chunk.functionCalls();
    if (functionCalls) {
      for (const call of functionCalls) {
        yield {
          name: call.name,
          args: call.args as Record<string, any>,
        } as ToolCall;
      }
    }
  }
}
