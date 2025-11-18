"use client";

import { GoogleGenAI } from "@google/genai";

export interface FileOperation {
  type: "write" | "delete";
  path: string;
  content?: string;
}

export interface AIMessage {
  role: "user" | "assistant";
  content: string;
  screenshot?: string; // base64 encoded image
  operations?: FileOperation[];
}

/**
 * Client-side Gemini integration with function calling for file operations
 * Uses proper Google AI SDK (@google/genai)
 */
export class GeminiClient {
  private ai: any;
  private modelName = "gemini-2.5-flash-lite";
  private tools: any;

  constructor(apiKey: string) {
    this.ai = new GoogleGenAI({ apiKey });

    // Define file operation tools as function declarations
    this.tools = [
      {
        functionDeclarations: [
          {
            name: "write_file",
            description: "Write or update a file in the React project. Always include the complete file content - never use placeholders or '...'",
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
          }
        ]
      }
    ];
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
      },
      tools: this.tools,
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
      }
    }

    // Get text from response
    try {
      textResponse = result.text || "";
    } catch (e) {
      // If no text available (function call only), create a summary
      if (operations.length > 0) {
        textResponse = `Applied ${operations.length} file operation(s):\n${operations.map(op => `• ${op.type} ${op.path}`).join('\n')}`;
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
      },
      tools: this.tools,
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
      }
    }

    // If we have operations but no text, provide a summary
    if (operations.length > 0 && !fullText) {
      const summaryText = `Applied ${operations.length} file operation(s):\n${operations.map(op => `• ${op.type} ${op.path}`).join('\n')}`;
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
You can write new files and modify code in a Vite + React + TypeScript project using the write_file and delete_file functions.

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

## Function Calling Instructions
IMPORTANT: Use the write_file function to write or update files. You MUST:
1. **Always include complete file content** - never use placeholders like "// rest of code..." or "..."
2. **Call write_file for each file** you want to create or modify
3. **Use forward slashes** in paths (e.g., "src/components/Button.tsx")
4. **Include all imports, types, and code** - the file must be complete and valid

## Workflow
1. First, explain what you'll build (1-2 sentences)
2. Then call write_file function(s) to create/update the necessary files
3. Briefly confirm what was created

## Example Response Pattern
"I'll create a beautiful landing page with a hero section and feature cards.

[calls write_file for src/App.tsx with complete code]
[calls write_file for src/components/Hero.tsx with complete code if needed]

Done! I've created a modern landing page with responsive design."

Tech Stack:
- Vite 5.4+
- React 18
- TypeScript 5.5+
- Tailwind CSS 3.4+`;
  }
}
