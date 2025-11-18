"use client";

import { GoogleGenerativeAI } from "@google/generative-ai";

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
 * Client-side Gemini integration for frontend code generation
 * Supports vision API for screenshot analysis
 */
export class GeminiClient {
  private client: GoogleGenerativeAI;
  private model: any;

  constructor(apiKey: string) {
    this.client = new GoogleGenerativeAI(apiKey);
    this.model = this.client.getGenerativeModel({
      model: "gemini-2.5-flash-lite",
      generationConfig: {
        temperature: 0.7, // Balance creativity and consistency
        topP: 0.95,
        topK: 40,
        maxOutputTokens: 8192, // Allow for longer code generation
      },
      safetySettings: [
        {
          category: "HARM_CATEGORY_HARASSMENT",
          threshold: "BLOCK_NONE",
        },
        {
          category: "HARM_CATEGORY_HATE_SPEECH",
          threshold: "BLOCK_NONE",
        },
        {
          category: "HARM_CATEGORY_SEXUALLY_EXPLICIT",
          threshold: "BLOCK_NONE",
        },
        {
          category: "HARM_CATEGORY_DANGEROUS_CONTENT",
          threshold: "BLOCK_NONE",
        },
      ],
    });
  }

  /**
   * Generate React component code from description
   */
  async generateComponent(
    userMessage: string,
    screenshot?: string,
    conversationHistory?: AIMessage[]
  ): Promise<{
    response: string;
    operations: FileOperation[];
  }> {
    const systemPrompt = `You are an expert React + TypeScript + Tailwind CSS developer helping users build beautiful web applications.

## Your Capabilities
You can read existing files, write new files, and modify code in a Vite + React + TypeScript project.

## Code Generation Standards
1. **React Patterns**: Use modern functional components with hooks (useState, useEffect, etc.)
2. **TypeScript**: Include proper type annotations, interfaces for props
3. **Tailwind CSS**: Use utility classes exclusively - no custom CSS files
4. **Responsive Design**: Mobile-first approach with md:, lg: breakpoints
5. **Accessibility**: Include ARIA labels, semantic HTML, keyboard navigation
6. **Code Quality**: Clean, readable code with helpful comments for complex logic

## File Structure
- src/App.tsx - Main application component (modify this most often)
- src/main.tsx - Entry point (don't modify unless specifically asked)
- src/index.css - Tailwind imports (don't modify)
- src/components/*.tsx - Create reusable components here
- src/types/*.ts - TypeScript type definitions (create as needed)

## Response Format
IMPORTANT: You MUST end your response with a JSON code block containing file operations:

\`\`\`json
{
  "operations": [
    {
      "type": "write",
      "path": "src/App.tsx",
      "content": "...complete file content here..."
    }
  ]
}
\`\`\`

## Operation Rules
1. **Always include complete file content** - never use placeholders or "..."
2. **One operation per file** - if modifying multiple files, include multiple operations
3. **Use forward slashes** in paths (e.g., "src/components/Button.tsx")
4. **Escape special characters** in JSON strings (quotes, newlines, etc.)

## Workflow
1. First, briefly explain what you'll build (1-2 sentences)
2. Then provide the complete code
3. Finally, add the JSON operations block

Tech Stack:
- Vite 5.4+
- React 18
- TypeScript 5.5+
- Tailwind CSS 3.4+`;

    // Build conversation
    const parts: any[] = [
      { text: systemPrompt },
    ];

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

    const result = await this.model.generateContent({
      contents: [{ role: "user", parts }],
    });

    const response = result.response.text();

    // Extract file operations from the response
    const operations = this.extractOperations(response);

    return {
      response,
      operations,
    };
  }

  /**
   * Stream generate with real-time updates
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
    const systemPrompt = `You are an expert React + TypeScript + Tailwind CSS developer helping users build beautiful web applications.

## Your Capabilities
You can read existing files, write new files, and modify code in a Vite + React + TypeScript project.

## Code Generation Standards
1. **React Patterns**: Use modern functional components with hooks (useState, useEffect, etc.)
2. **TypeScript**: Include proper type annotations, interfaces for props
3. **Tailwind CSS**: Use utility classes exclusively - no custom CSS files
4. **Responsive Design**: Mobile-first approach with md:, lg: breakpoints
5. **Accessibility**: Include ARIA labels, semantic HTML, keyboard navigation
6. **Code Quality**: Clean, readable code with helpful comments for complex logic

## File Structure
- src/App.tsx - Main application component (modify this most often)
- src/main.tsx - Entry point (don't modify unless specifically asked)
- src/index.css - Tailwind imports (don't modify)
- src/components/*.tsx - Create reusable components here
- src/types/*.ts - TypeScript type definitions (create as needed)

## Response Format
IMPORTANT: You MUST end your response with a JSON code block containing file operations:

\`\`\`json
{
  "operations": [
    {
      "type": "write",
      "path": "src/App.tsx",
      "content": "...complete file content here..."
    }
  ]
}
\`\`\`

## Operation Rules
1. **Always include complete file content** - never use placeholders or "..."
2. **One operation per file** - if modifying multiple files, include multiple operations
3. **Use forward slashes** in paths (e.g., "src/components/Button.tsx")
4. **Escape special characters** in JSON strings (quotes, newlines, etc.)

## Workflow
1. First, briefly explain what you'll build (1-2 sentences)
2. Then provide the complete code
3. Finally, add the JSON operations block

Tech Stack:
- Vite 5.4+
- React 18
- TypeScript 5.5+
- Tailwind CSS 3.4+`;

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

    const result = await this.model.generateContentStream({
      contents: [{ role: "user", parts }],
    });

    let fullText = "";

    for await (const chunk of result.stream) {
      const text = chunk.text();
      if (text) {
        fullText += text;
        yield { text, done: false };
      }
    }

    // Extract operations from the full response
    const operations = this.extractOperations(fullText);

    yield { operations, done: true };
  }

  /**
   * Extract file operations from AI response
   * Supports multiple formats and handles edge cases
   */
  private extractOperations(response: string): FileOperation[] {
    // Try multiple patterns to find JSON operations

    // Pattern 1: Standard JSON code block
    let jsonBlockRegex = /```json\s*(\{[\s\S]*?\})\s*```/;
    let match = response.match(jsonBlockRegex);

    // Pattern 2: JSON without the 'json' language specifier
    if (!match) {
      jsonBlockRegex = /```\s*(\{[\s\S]*?operations[\s\S]*?\})\s*```/;
      match = response.match(jsonBlockRegex);
    }

    // Pattern 3: Bare JSON object (no code block)
    if (!match) {
      jsonBlockRegex = /(\{[\s\S]*?"operations"\s*:\s*\[[\s\S]*?\]\s*\})/;
      match = response.match(jsonBlockRegex);
    }

    if (match) {
      try {
        // Clean up the JSON string
        let jsonStr = match[1].trim();

        // Remove any trailing commas before closing braces/brackets
        jsonStr = jsonStr.replace(/,(\s*[}\]])/g, '$1');

        const parsed = JSON.parse(jsonStr);

        if (parsed.operations && Array.isArray(parsed.operations)) {
          // Validate operations
          return parsed.operations.filter((op: any) => {
            return (
              op &&
              typeof op === 'object' &&
              (op.type === 'write' || op.type === 'delete') &&
              typeof op.path === 'string' &&
              (op.type === 'delete' || typeof op.content === 'string')
            );
          });
        }
      } catch (e) {
        console.error("Failed to parse operations JSON:", e);
        console.error("Attempted to parse:", match[1]);
      }
    } else {
      console.warn("No operations block found in AI response");
    }

    return [];
  }
}
