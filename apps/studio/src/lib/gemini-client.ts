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
    const systemPrompt = `You are an expert React + TypeScript + Tailwind CSS developer.

Your job is to help users build beautiful, modern web applications.

Guidelines:
- Generate clean, modern React components using TypeScript
- Use Tailwind CSS for all styling (no custom CSS unless necessary)
- Make components responsive and accessible
- Use modern React patterns (hooks, functional components)
- Keep components focused and reusable
- Add helpful comments for complex logic

When the user asks you to create or modify something:
1. Explain what you're going to build
2. Generate the necessary code
3. Specify file operations in this JSON format at the end:

\`\`\`json
{
  "operations": [
    {
      "type": "write",
      "path": "src/App.tsx",
      "content": "... full file content ..."
    }
  ]
}
\`\`\`

Available files structure:
- src/App.tsx (main component)
- src/main.tsx (entry point, don't modify)
- src/index.css (Tailwind imports, usually don't modify)
- src/components/*.tsx (create components here)

You can create new files in src/ or src/components/ as needed.

Current tech stack:
- Vite
- React 18
- TypeScript
- Tailwind CSS 3
`;

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
    const systemPrompt = `You are an expert React + TypeScript + Tailwind CSS developer.

Your job is to help users build beautiful, modern web applications.

Guidelines:
- Generate clean, modern React components using TypeScript
- Use Tailwind CSS for all styling
- Make components responsive and accessible
- Use modern React patterns (hooks, functional components)

When the user asks you to create or modify something:
1. Explain what you're going to build
2. Generate the necessary code
3. Specify file operations in this JSON format at the end:

\`\`\`json
{
  "operations": [
    {
      "type": "write",
      "path": "src/App.tsx",
      "content": "... full file content ..."
    }
  ]
}
\`\`\`
`;

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
   */
  private extractOperations(response: string): FileOperation[] {
    // Look for JSON code block with operations
    const jsonBlockRegex = /```json\s*(\{[\s\S]*?\})\s*```/;
    const match = response.match(jsonBlockRegex);

    if (match) {
      try {
        const parsed = JSON.parse(match[1]);
        if (parsed.operations && Array.isArray(parsed.operations)) {
          return parsed.operations;
        }
      } catch (e) {
        console.error("Failed to parse operations JSON:", e);
      }
    }

    return [];
  }
}
