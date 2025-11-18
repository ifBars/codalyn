"use client";

import { GoogleGenAI } from "@google/genai";

export interface FileOperation {
  type: "write" | "delete" | "install_package";
  path?: string;
  content?: string;
  packages?: string[];
}

export interface AIMessage {
  role: "user" | "assistant";
  content: string;
  screenshot?: string; // base64 encoded image
  operations?: FileOperation[];
}

// Enum for function calling modes (matching SDK)
const FunctionCallingMode = {
  AUTO: "AUTO",
  ANY: "ANY",
  NONE: "NONE"
} as const;

/**
 * Client-side Gemini integration with function calling for file operations
 * Uses proper Google AI SDK (@google/genai)
 */
export class GeminiClient {
  private ai: any;
  private modelName = "gemini-2.5-flash-lite";
  private tools: any;
  private toolConfig: any;

  constructor(apiKey: string) {
    this.ai = new GoogleGenAI({ apiKey });

    // Define file operation tools as function declarations
    this.tools = [
      {
        functionDeclarations: [
          {
            name: "write_file",
            description: "Write or update a file in the React project. ALWAYS use this function to create or modify files. Include the complete file content - never use placeholders or '...'",
            parameters: {
              type: "object",
              properties: {
                path: {
                  type: "string",
                  description: "File path relative to project root (e.g., 'src/App.tsx', 'src/components/Button.tsx')"
                },
                content: {
                  type: "string",
                  description: "Complete file content. Must be the full file, not partial code or snippets."
                }
              },
              required: ["path", "content"]
            }
          },
          {
            name: "delete_file",
            description: "Delete a file from the project",
            parameters: {
              type: "object",
              properties: {
                path: {
                  type: "string",
                  description: "File path relative to project root to delete"
                }
              },
              required: ["path"]
            }
          },
          {
            name: "install_package",
            description: "Install npm packages. Use this when your code requires external dependencies (like uuid, axios, date-fns, etc). Always install packages BEFORE writing files that use them.",
            parameters: {
              type: "object",
              properties: {
                packages: {
                  type: "array",
                  items: { type: "string" },
                  description: "Array of package names to install (e.g., ['uuid', 'axios'])"
                }
              },
              required: ["packages"]
            }
          }
        ]
      }
    ];

    // Configure tool calling to force function use
    this.toolConfig = {
      functionCallingConfig: {
        mode: FunctionCallingMode.ANY,
        allowedFunctionNames: ["write_file", "delete_file", "install_package"]
      }
    };
  }

  /**
   * Generate React component code with function calling
   */
  async generateComponent(
    userMessage: string,
    screenshot?: string,
    conversationHistory?: AIMessage[]
  ): Promise<{
    response: string;
    operations: FileOperation[];
  }> {
    const systemPrompt = this.getSystemPrompt();

    // Build conversation parts
    const parts: any[] = [{ text: systemPrompt }];

    // Add conversation history
    if (conversationHistory) {
      for (const msg of conversationHistory) {
        if (msg.role === "user") {
          if (msg.screenshot) {
            parts.push({
              inlineData: {
                mimeType: "image/png",
                data: msg.screenshot,
              },
            });
          }
          parts.push({ text: msg.content });
        } else {
          parts.push({ text: msg.content });
        }
      }
    }

    // Add current message
    if (screenshot) {
      parts.push({
        inlineData: {
          mimeType: "image/png",
          data: screenshot,
        },
      });
      parts.push({
        text: `Here's a screenshot of the current UI. ${userMessage}`
      });
    } else {
      parts.push({ text: userMessage });
    }

    const result = await this.ai.models.generateContent({
      model: this.modelName,
      contents: [{ role: "user", parts }],
      config: {
        temperature: 0.7,
        topP: 0.95,
        topK: 40,
        maxOutputTokens: 8192,
        safetySettings: [
          { category: "HARM_CATEGORY_HARASSMENT", threshold: "BLOCK_NONE" },
          { category: "HARM_CATEGORY_HATE_SPEECH", threshold: "BLOCK_NONE" },
          { category: "HARM_CATEGORY_SEXUALLY_EXPLICIT", threshold: "BLOCK_NONE" },
          { category: "HARM_CATEGORY_DANGEROUS_CONTENT", threshold: "BLOCK_NONE" },
        ],
        tools: this.tools,
        toolConfig: this.toolConfig,
      }
    });

    let textResponse = "";
    const operations: FileOperation[] = [];

    // Check if response has function calls
    const functionCalls = result.functionCalls || [];

    for (const funcCall of functionCalls) {
      if (funcCall.name === "write_file") {
        operations.push({
          type: "write",
          path: funcCall.args.path,
          content: funcCall.args.content,
        });
      } else if (funcCall.name === "delete_file") {
        operations.push({
          type: "delete",
          path: funcCall.args.path,
        });
      } else if (funcCall.name === "install_package") {
        operations.push({
          type: "install_package",
          packages: funcCall.args.packages,
        });
      }
    }

    // Get text from response
    try {
      textResponse = result.text || "";
    } catch (e) {
      // If no text available (function call only), create a summary
      if (operations.length > 0) {
        textResponse = `Created ${operations.length} file(s):\n${operations.map(op => `• ${op.path}`).join('\n')}`;
      }
    }

    return {
      response: textResponse,
      operations,
    };
  }

  /**
   * Stream generate with real-time updates and function calling
   */
  async *streamGenerate(
    userMessage: string,
    screenshot?: string,
    conversationHistory?: AIMessage[]
  ): AsyncGenerator<{
    text?: string;
    operations?: FileOperation[];
    done: boolean;
  }> {
    const systemPrompt = this.getSystemPrompt();

    const parts: any[] = [{ text: systemPrompt }];

    // Add conversation history
    if (conversationHistory) {
      for (const msg of conversationHistory) {
        if (msg.role === "user") {
          if (msg.screenshot) {
            parts.push({
              inlineData: {
                mimeType: "image/png",
                data: msg.screenshot,
              },
            });
          }
          parts.push({ text: msg.content });
        } else {
          parts.push({ text: msg.content });
        }
      }
    }

    // Add current message
    if (screenshot) {
      parts.push({
        inlineData: {
          mimeType: "image/png",
          data: screenshot,
        },
      });
      parts.push({
        text: `Here's a screenshot of the current UI. ${userMessage}`
      });
    } else {
      parts.push({ text: userMessage });
    }

    const stream = await this.ai.models.generateContentStream({
      model: this.modelName,
      contents: [{ role: "user", parts }],
      config: {
        temperature: 0.7,
        topP: 0.95,
        topK: 40,
        maxOutputTokens: 8192,
        safetySettings: [
          { category: "HARM_CATEGORY_HARASSMENT", threshold: "BLOCK_NONE" },
          { category: "HARM_CATEGORY_HATE_SPEECH", threshold: "BLOCK_NONE" },
          { category: "HARM_CATEGORY_SEXUALLY_EXPLICIT", threshold: "BLOCK_NONE" },
          { category: "HARM_CATEGORY_DANGEROUS_CONTENT", threshold: "BLOCK_NONE" },
        ],
        tools: this.tools,
        toolConfig: this.toolConfig,
      }
    });

    let fullText = "";
    let allFunctionCalls: any[] = [];

    // Stream text chunks
    for await (const chunk of stream) {
      // Collect function calls from chunks
      if (chunk.functionCalls && chunk.functionCalls.length > 0) {
        allFunctionCalls.push(...chunk.functionCalls);
      }

      const text = chunk.text || "";
      if (text) {
        fullText += text;
        yield { text, done: false };
      }
    }

    // Extract operations from function calls
    const operations: FileOperation[] = [];
    for (const funcCall of allFunctionCalls) {
      if (funcCall.name === "write_file") {
        operations.push({
          type: "write",
          path: funcCall.args.path,
          content: funcCall.args.content,
        });
      } else if (funcCall.name === "delete_file") {
        operations.push({
          type: "delete",
          path: funcCall.args.path,
        });
      } else if (funcCall.name === "install_package") {
        operations.push({
          type: "install_package",
          packages: funcCall.args.packages,
        });
      }
    }

    // If we have operations but no text, provide a summary
    if (operations.length > 0 && !fullText) {
      const summaryText = `Created ${operations.length} file(s):\n${operations.map(op => `• ${op.path}`).join('\n')}`;
      yield { text: summaryText, done: false };
    }

    yield { operations, done: true };
  }

  /**
   * Get system prompt for the AI
   */
  private getSystemPrompt(): string {
    return `You are an expert React + TypeScript + Tailwind CSS developer helping users build beautiful web applications.

## Your Capabilities
You have three functions available:
1. install_package - Install npm packages when your code needs external dependencies
2. write_file - Create or modify files in the project
3. delete_file - Remove files from the project

ALWAYS use these functions instead of outputting code as text.

## Code Generation Standards
1. **React Patterns**: Use modern functional components with hooks (useState, useEffect, etc.)
2. **TypeScript**: Include proper type annotations, interfaces for props
3. **Tailwind CSS**: Use utility classes exclusively - no custom CSS files
4. **Responsive Design**: Mobile-first approach with md:, lg: breakpoints
5. **Accessibility**: Include ARIA labels, semantic HTML, keyboard navigation
6. **Code Quality**: Clean, readable code with helpful comments for complex logic

## Project File Structure
- src/App.tsx - Main application component (modify this most often)
- src/main.tsx - Entry point (don't modify unless specifically asked)
- src/index.css - Tailwind imports (don't modify)
- src/components/*.tsx - Create reusable components here
- src/types/*.ts - TypeScript type definitions (create as needed)
- src/hooks/*.ts - Custom React hooks (create as needed)
- src/utils/*.ts - Utility functions (create as needed)

## CRITICAL: Function Calling Requirements
You MUST use functions for ALL operations. NEVER output code as markdown or text.

### Installing Packages
When your code needs external dependencies (like uuid, axios, date-fns, etc):
1. Call install_package FIRST with the package names
2. Wait for installation to complete
3. Then write files that import those packages

Example: If using uuid, call install_package(["uuid", "@types/uuid"]) before writing files

### Writing Files
For EVERY file you create or modify:
1. Call write_file function with path and complete content
2. Include ALL imports, types, and code - no placeholders
3. Use forward slashes in paths (e.g., "src/components/Button.tsx")
4. Provide the ENTIRE file content, not snippets

## Workflow
1. Briefly explain what you'll build (1 sentence)
2. If you need external packages, call install_package first
3. Call write_file for EACH file you need to create/modify
4. Confirm completion

## Example
User: "Create a todo app with unique IDs"
Response: "I'll create a todo app with the uuid library for generating unique IDs."
[Call install_package(["uuid", "@types/uuid"])]
[Then call write_file for src/App.tsx with complete code that imports uuid]

Tech Stack:
- Vite 5.4+
- React 18
- TypeScript 5.5+
- Tailwind CSS 3.4+

Remember: ALWAYS use write_file function. NEVER output code in your text response.`;
  }
}
