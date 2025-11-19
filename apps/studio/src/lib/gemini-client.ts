"use client";

import { GoogleGenAI, FunctionCallingConfigMode } from "@google/genai";
import type React from "react";
import { captureIframeScreenshot, getGlobalIframe } from "./screenshot";

export type GeminiModelId =
  | "gemini-2.5-flash"
  | "gemini-2.5-flash-lite"
  | "gemini-flash-lite-latest"
  | "gemini-2.5-pro"
  | "gemini-2.5-flash-lite-latest";

export const GEMINI_MODEL_OPTIONS: Array<{
  id: GeminiModelId;
  label: string;
  description: string;
}> = [
  {
    id: "gemini-2.5-flash",
    label: "Gemini 2.5 Flash",
    description: "Fast, capable generalist for most UI builds.",
  },
  {
    id: "gemini-2.5-flash-lite",
    label: "Gemini 2.5 Flash Lite",
    description: "Default balance of speed + quality.",
  },
  {
    id: "gemini-2.5-flash-lite-latest",
    label: "Gemini 2.5 Flash Lite (latest)",
    description: "Cutting edge lite model with latest weights.",
  },
  {
    id: "gemini-flash-lite-latest",
    label: "Gemini Flash Lite (latest)",
    description: "Lightweight model ideal for rapid prototyping.",
  },
  {
    id: "gemini-2.5-pro",
    label: "Gemini 2.5 Pro",
    description: "Highest quality responses, slower latency.",
  },
];

export const DEFAULT_GEMINI_MODEL: GeminiModelId = "gemini-2.5-flash-lite";

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

// Use FunctionCallingConfigMode from SDK

/**
 * Client-side Gemini integration with function calling for file operations
 * Uses proper Google AI SDK (@google/genai)
 */
/**
 * Filter out random code blocks and irrelevant content from LLM responses
 */
function filterResponseText(text: string): string {
  if (!text) return text;
  
  let filtered = text;
  
  // Remove "File content:" headers followed by code blocks
  filtered = filtered.replace(/File content:\s*\n\s*```[\s\S]*?```/gi, '');
  
  // Remove large code blocks that look like complete files (not snippets)
  // Pattern: code blocks with imports/exports and many lines
  filtered = filtered.replace(/```[\w]*\n([\s\S]*?)```/g, (match, content) => {
    const lineCount = content.split('\n').length;
    const hasImports = /import\s+.*from/.test(content);
    const hasExports = /export\s+(default\s+)?(const|function|class|interface|type)/.test(content);
    const isLargeFile = lineCount > 30 && content.length > 500;
    
    // Remove if it looks like a complete file dump
    if (isLargeFile && (hasImports || hasExports)) {
      return '';
    }
    
    return match;
  });
  
  // Remove "File content:" lines followed by large code blocks (without markdown)
  filtered = filtered.replace(/File content:\s*\n([\s\S]{300,}?)(?=\n\n|\n[A-Z]|$)/g, '');
  
  // Remove standalone code lines (like "export default App;")
  // Pattern: lines that look like code statements without context
  filtered = filtered.replace(/^(export\s+(default\s+)?[\w]+\s*;?\s*)$/gm, '');
  filtered = filtered.replace(/^(import\s+.*from\s+['"].*['"]\s*;?\s*)$/gm, '');
  filtered = filtered.replace(/^(const\s+\w+\s*=.*;?\s*)$/gm, '');
  filtered = filtered.replace(/^(function\s+\w+.*\{?\s*)$/gm, '');
  
  // Clean up multiple consecutive newlines
  filtered = filtered.replace(/\n{3,}/g, '\n\n');
  
  // Remove leading/trailing whitespace
  filtered = filtered.trim();
  
  return filtered;
}

/**
 * Check if text response contains code without tool calls
 * Returns true if code is detected and should be rejected
 */
function containsCodeWithoutTools(text: string, hasToolCalls: boolean): boolean {
  if (!text || hasToolCalls) return false;
  
  // Check for code patterns
  const codePatterns = [
    /^export\s+(default\s+)?[\w]+\s*;?\s*$/m,  // "export default App;"
    /^import\s+.*from\s+['"].*['"]\s*;?\s*$/m,  // import statements
    /^const\s+\w+\s*=.*;?\s*$/m,  // const declarations
    /^function\s+\w+.*\{?\s*$/m,  // function declarations
    /^class\s+\w+.*\{?\s*$/m,  // class declarations
    /```[\w]*\n[\s\S]*?```/,  // code blocks
  ];
  
  return codePatterns.some(pattern => pattern.test(text.trim()));
}

export class GeminiClient {
  private ai: any;
  private modelName: GeminiModelId;
  private tools: any;
  private toolConfig: any;
  private vectorStore: any; // Will be set from outside
  private iframeRef: React.RefObject<HTMLIFrameElement> | null = null; // For screenshot capture

  constructor(apiKey: string, modelName: GeminiModelId = DEFAULT_GEMINI_MODEL) {
    this.ai = new GoogleGenAI({ apiKey });
    this.modelName = modelName;

    // Define file operation tools as function declarations
    // Using parametersJsonSchema as required by @google/genai SDK
    this.tools = [
      {
        functionDeclarations: [
          {
            name: "write_file",
            description: "Write or update a file in the React project. ALWAYS use this function to create or modify files. Include the complete file content - never use placeholders or '...'",
            parametersJsonSchema: {
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
            parametersJsonSchema: {
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
            description: "Install npm packages. Use this when your code requires external dependencies (like uuid, axios, date-fns, etc). CRITICAL: After calling this function, you MUST immediately continue and call write_file for all files that use these packages in the SAME response. Do NOT stop after install_package.",
            parametersJsonSchema: {
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
          },
          {
            name: "read_file",
            description: "Read the contents of a file from the workspace. Supports chunking for large files. Use this to examine project files before making changes. ALWAYS use this tool to understand the current codebase structure.",
            parametersJsonSchema: {
              type: "object",
              properties: {
                path: {
                  type: "string",
                  description: "Path to the file relative to project root (e.g., 'src/App.tsx')"
                },
                chunk: {
                  type: "boolean",
                  description: "If true, return file in chunks (useful for large files). Default: false"
                },
                chunkIndex: {
                  type: "number",
                  description: "If chunking is enabled, specify which chunk to read (0-indexed). If not specified, returns all chunks."
                },
                maxChunkSize: {
                  type: "number",
                  description: "Maximum size of each chunk in characters (default: 1000). Only used when chunk=true"
                }
              },
              required: ["path"]
            }
          },
          {
            name: "search_project",
            description: "Search the project codebase using semantic search. Use this to find relevant files and code snippets based on natural language queries. The search uses embeddings to find semantically similar code. Use this when you need to find where certain functionality is implemented.",
            parametersJsonSchema: {
              type: "object",
              properties: {
                query: {
                  type: "string",
                  description: "Natural language search query describing what you're looking for (e.g., 'authentication logic', 'API route handlers', 'component state management')"
                },
                limit: {
                  type: "number",
                  description: "Maximum number of results to return (default: 5)"
                }
              },
              required: ["query"]
            }
          },
          {
            name: "capture_screenshot",
            description: "Capture a screenshot of the current live preview. Use this when you need to see what the UI currently looks like, especially after making changes. This helps you understand the visual state of the application.",
            parametersJsonSchema: {
              type: "object",
              properties: {},
              required: []
            }
          }
        ]
      }
    ];

    // Configure tool calling to force function use
    this.toolConfig = {
      functionCallingConfig: {
        mode: FunctionCallingConfigMode.ANY,
        allowedFunctionNames: ["write_file", "delete_file", "install_package", "read_file", "search_project", "capture_screenshot"]
      }
    };
  }

  /**
   * Set the vector store instance for search functionality
   */
  setVectorStore(vectorStore: any): void {
    this.vectorStore = vectorStore;
  }

  /**
   * Set the iframe reference for screenshot capture
   */
  setIframeRef(iframeRef: React.RefObject<HTMLIFrameElement>): void {
    this.iframeRef = iframeRef;
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

    // Extract and validate operations from function calls
    const invalidOperations: string[] = [];
    
    for (const funcCall of functionCalls) {
      if (funcCall.name === "write_file") {
        const path = funcCall.args?.path;
        const content = funcCall.args?.content;
        
        if (!path || typeof path !== 'string') {
          invalidOperations.push(`write_file: missing or invalid path`);
          continue;
        }
        if (content === undefined || content === null) {
          invalidOperations.push(`write_file "${path}": missing content`);
          continue;
        }
        
        operations.push({
          type: "write",
          path: path,
          content: String(content),
        });
      } else if (funcCall.name === "delete_file") {
        const path = funcCall.args?.path;
        
        if (!path || typeof path !== 'string') {
          invalidOperations.push(`delete_file: missing or invalid path`);
          continue;
        }
        
        operations.push({
          type: "delete",
          path: path,
        });
      } else if (funcCall.name === "install_package") {
        const packages = funcCall.args?.packages;
        
        if (!Array.isArray(packages) || packages.length === 0) {
          invalidOperations.push(`install_package: missing or invalid packages array`);
          continue;
        }
        
        // Validate all packages are strings
        const validPackages = packages.filter(p => typeof p === 'string' && p.trim().length > 0);
        if (validPackages.length === 0) {
          invalidOperations.push(`install_package: no valid package names provided`);
          continue;
        }
        
        operations.push({
          type: "install_package",
          packages: validPackages,
        });
      }
    }

    // Log invalid operations for debugging
    if (invalidOperations.length > 0) {
      console.warn('Invalid operations detected:', invalidOperations);
    }

    // Get text from response
    try {
      textResponse = result.text || "";
      // Filter out random code blocks
      textResponse = filterResponseText(textResponse);
      
      // CRITICAL: Reject responses that contain code without tool calls
      const hasAnyToolCalls = functionCalls.length > 0 || operations.length > 0;
      if (containsCodeWithoutTools(textResponse, hasAnyToolCalls)) {
        console.warn('Rejected response containing code without tool calls:', textResponse);
        textResponse = 'ERROR: Code was output directly instead of using tools. Please use the write_file tool to create or modify files. Code must never be output in text responses.';
      }
    } catch (e) {
      // If no text available (function call only), create a summary
      if (operations.length > 0) {
        const fileOps = operations.filter(op => op.type === 'write' || op.type === 'delete');
        const installOps = operations.filter(op => op.type === 'install_package');
        
        const parts: string[] = [];
        
        if (fileOps.length > 0) {
          const fileList = fileOps.map(op => `• ${op.path || 'unknown'}`).join('\n');
          parts.push(`Created ${fileOps.length} file operation(s):\n${fileList}`);
        }
        
        if (installOps.length > 0) {
          const packageList = installOps.map(op => op.packages?.join(', ') || 'unknown').join(', ');
          parts.push(`Installing packages: ${packageList}`);
        }
        
        textResponse = parts.join('\n\n');
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
    screenshot?: string; // base64 encoded screenshot from capture_screenshot tool
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
        maxOutputTokens: 16384, // Increased to allow more function calls and content
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
    let lastFilteredLength = 0;
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
        // Filter accumulated text to handle multi-chunk code blocks
        const filteredAccumulated = filterResponseText(fullText);
        // Yield only the new filtered content since last yield
        const newContent = filteredAccumulated.slice(lastFilteredLength);
        if (newContent) {
          yield { text: newContent, done: false };
        }
        lastFilteredLength = filteredAccumulated.length;
      }
    }

    // Handle function calls that need execution (read_file, search_project)
    // These are executed immediately and results are fed back to the AI
    const functionCallResults: any[] = [];
    
    for (const funcCall of allFunctionCalls) {
      if (funcCall.name === "read_file") {
        try {
          const path = funcCall.args?.path;
          const chunk = funcCall.args?.chunk || false;
          const chunkIndex = funcCall.args?.chunkIndex;
          const maxChunkSize = funcCall.args?.maxChunkSize || 1000;
          
          if (!path) {
            functionCallResults.push({
              name: funcCall.name,
              result: { error: "Missing path parameter" }
            });
            continue;
          }

          // Import WebContainerManager dynamically
          const { WebContainerManager } = await import("./webcontainer-manager");
          const content = await WebContainerManager.readFile(path);
          
          if (chunk) {
            const { chunkText } = await import("./embeddings");
            const chunks = chunkText(content, maxChunkSize);
            
            if (chunkIndex !== undefined) {
              if (chunkIndex < 0 || chunkIndex >= chunks.length) {
                functionCallResults.push({
                  name: funcCall.name,
                  result: { error: `Chunk index ${chunkIndex} out of range. File has ${chunks.length} chunks.` }
                });
                continue;
              }
              functionCallResults.push({
                name: funcCall.name,
                result: {
                  chunk: chunks[chunkIndex],
                  chunkIndex,
                  totalChunks: chunks.length,
                  path
                }
              });
            } else {
              functionCallResults.push({
                name: funcCall.name,
                result: { chunks, totalChunks: chunks.length, path }
              });
            }
          } else {
            functionCallResults.push({
              name: funcCall.name,
              result: content
            });
          }
        } catch (error) {
          functionCallResults.push({
            name: funcCall.name,
            result: { error: error instanceof Error ? error.message : "Unknown error" }
          });
        }
        continue;
      }
      
      if (funcCall.name === "search_project") {
        try {
          const query = funcCall.args?.query;
          const limit = funcCall.args?.limit || 5;
          
          if (!query) {
            functionCallResults.push({
              name: funcCall.name,
              result: { error: "Missing query parameter" }
            });
            continue;
          }

          if (!this.vectorStore) {
            functionCallResults.push({
              name: funcCall.name,
              result: { error: "Vector store not initialized" }
            });
            continue;
          }

          const results = await this.vectorStore.search(query, limit);
          functionCallResults.push({
            name: funcCall.name,
            result: {
              query,
              results: results.map(r => ({
                path: r.path,
                chunkIndex: r.chunkIndex,
                content: r.content,
                score: r.score
              }))
            }
          });
        } catch (error) {
          functionCallResults.push({
            name: funcCall.name,
            result: { error: error instanceof Error ? error.message : "Unknown error" }
          });
        }
        continue;
      }

      if (funcCall.name === "capture_screenshot") {
        try {
          // Try to get iframe from ref first, then fall back to global registry
          let iframe: HTMLIFrameElement | null = null;
          if (this.iframeRef?.current) {
            iframe = this.iframeRef.current;
          } else {
            iframe = getGlobalIframe();
          }

          if (!iframe) {
            functionCallResults.push({
              name: funcCall.name,
              result: { error: "Preview iframe not available. The preview may not be loaded yet." }
            });
            continue;
          }
          
          // Check if iframe is in the DOM
          if (!iframe.isConnected) {
            functionCallResults.push({
              name: funcCall.name,
              result: { error: "Preview iframe is not connected to the DOM." }
            });
            continue;
          }

          // Check iframe dimensions
          const rect = iframe.getBoundingClientRect();
          if (rect.width === 0 || rect.height === 0) {
            functionCallResults.push({
              name: funcCall.name,
              result: { error: `Preview iframe has zero dimensions (${rect.width}x${rect.height}). The preview may not be visible yet.` }
            });
            continue;
          }

          // Check if iframe has a src
          if (!iframe.src && !iframe.contentWindow?.location.href) {
            functionCallResults.push({
              name: funcCall.name,
              result: { error: "Preview iframe has no source URL. The preview may not be initialized yet." }
            });
            continue;
          }

          // Try to capture screenshot with retries
          let screenshot: string | null = null;
          let lastError: string | null = null;
          
          // Try up to 3 times with increasing delays
          for (let attempt = 0; attempt < 3; attempt++) {
            if (attempt > 0) {
              // Wait before retry: 500ms, 1000ms
              await new Promise(resolve => setTimeout(resolve, 500 * attempt));
            }
            
            try {
              screenshot = await captureIframeScreenshot(iframe);
              if (screenshot) {
                break; // Success!
              }
            } catch (e) {
              lastError = e instanceof Error ? e.message : String(e);
            }
          }

          if (!screenshot) {
            // Provide more detailed error information
            let errorDetails = "Failed to capture screenshot after multiple attempts.";
            
            // Check iframe state
            const rect = iframe.getBoundingClientRect();
            if (rect.width === 0 || rect.height === 0) {
              errorDetails += ` Iframe has zero dimensions (${rect.width}x${rect.height}).`;
            }
            
            // Try to determine if it's cross-origin
            try {
              const doc = iframe.contentDocument || iframe.contentWindow?.document;
              if (!doc) {
                errorDetails += " Cannot access iframe content (likely cross-origin).";
              } else {
                errorDetails += ` Document state: ${doc.readyState}.`;
                if (!doc.body || doc.body.children.length === 0) {
                  errorDetails += " Document body is empty.";
                }
              }
            } catch (e) {
              errorDetails += " Cannot access iframe content (cross-origin restriction).";
            }
            
            if (lastError) {
              errorDetails += ` Last error: ${lastError}`;
            }
            
            functionCallResults.push({
              name: funcCall.name,
              result: { error: errorDetails }
            });
            continue;
          }

          functionCallResults.push({
            name: funcCall.name,
            result: {
              success: true,
              screenshot: screenshot, // base64 encoded image
              message: "Screenshot captured successfully"
            }
          });
        } catch (error) {
          functionCallResults.push({
            name: funcCall.name,
            result: { error: error instanceof Error ? error.message : "Unknown error" }
          });
        }
        continue;
      }
    }

    // If we have function call results, we need to continue the conversation with those results
    // For now, we'll include them in the response text
    if (functionCallResults.length > 0) {
      const resultsText = functionCallResults.map(fcr => {
        if (fcr.name === "read_file") {
          if (fcr.result.error) {
            return `read_file error: ${fcr.result.error}`;
          }
          if (typeof fcr.result === "string") {
            return `File content:\n${fcr.result}`;
          }
          if (fcr.result.chunks) {
            return `File has ${fcr.result.totalChunks} chunks:\n${fcr.result.chunks.map((c: string, i: number) => `Chunk ${i}:\n${c}`).join("\n\n")}`;
          }
          if (fcr.result.chunk) {
            return `Chunk ${fcr.result.chunkIndex} of ${fcr.result.totalChunks}:\n${fcr.result.chunk}`;
          }
        }
        if (fcr.name === "search_project") {
          if (fcr.result.error) {
            return `search_project error: ${fcr.result.error}`;
          }
          return `Search results for "${fcr.result.query}":\n${fcr.result.results.map((r: any, i: number) => `${i + 1}. ${r.path} (score: ${r.score.toFixed(3)})\n${r.content.substring(0, 200)}...`).join("\n\n")}`;
        }
        if (fcr.name === "capture_screenshot") {
          if (fcr.result.error) {
            return `capture_screenshot error: ${fcr.result.error}`;
          }
          // Screenshot is included in the result, will be handled by the UI
          return `Screenshot captured successfully.`;
        }
        return JSON.stringify(fcr.result);
      }).join("\n\n");
      
      fullText += "\n\n" + resultsText;
      
      // Check if any function calls returned screenshots
      const screenshotResults = functionCallResults.filter(fcr => 
        fcr.name === "capture_screenshot" && fcr.result.success && fcr.result.screenshot
      );
      
      // Filter the results text to remove any code blocks
      const filteredResultsText = filterResponseText(resultsText);
      
      yield { 
        text: filteredResultsText, 
        screenshot: screenshotResults.length > 0 ? screenshotResults[0].result.screenshot : undefined,
        done: false 
      };
    }

    // Extract and validate operations from function calls (write_file, delete_file, install_package)
    const operations: FileOperation[] = [];
    const invalidOperations: string[] = [];
    
    for (const funcCall of allFunctionCalls) {
      if (funcCall.name === "write_file") {
        const path = funcCall.args?.path;
        const content = funcCall.args?.content;
        
        if (!path || typeof path !== 'string') {
          invalidOperations.push(`write_file: missing or invalid path`);
          continue;
        }
        if (content === undefined || content === null) {
          invalidOperations.push(`write_file "${path}": missing content`);
          continue;
        }
        
        operations.push({
          type: "write",
          path: path,
          content: String(content),
        });
      } else if (funcCall.name === "delete_file") {
        const path = funcCall.args?.path;
        
        if (!path || typeof path !== 'string') {
          invalidOperations.push(`delete_file: missing or invalid path`);
          continue;
        }
        
        operations.push({
          type: "delete",
          path: path,
        });
      } else if (funcCall.name === "install_package") {
        const packages = funcCall.args?.packages;
        
        if (!Array.isArray(packages) || packages.length === 0) {
          invalidOperations.push(`install_package: missing or invalid packages array`);
          continue;
        }
        
        // Validate all packages are strings
        const validPackages = packages.filter(p => typeof p === 'string' && p.trim().length > 0);
        if (validPackages.length === 0) {
          invalidOperations.push(`install_package: no valid package names provided`);
          continue;
        }
        
        operations.push({
          type: "install_package",
          packages: validPackages,
        });
      }
    }

    // Log invalid operations for debugging
    if (invalidOperations.length > 0) {
      console.warn('Invalid operations detected:', invalidOperations);
    }

    // Get the final filtered text (already filtered incrementally above)
    const filteredFullText = filterResponseText(fullText);
    
    // CRITICAL: Reject responses that contain code without tool calls
    const hasAnyToolCalls = allFunctionCalls.length > 0 || operations.length > 0;
    if (containsCodeWithoutTools(filteredFullText, hasAnyToolCalls)) {
      console.warn('Rejected response containing code without tool calls:', filteredFullText);
      yield { 
        text: 'ERROR: Code was output directly instead of using tools. Please use the write_file tool to create or modify files. Code must never be output in text responses.', 
        done: false 
      };
      yield { operations: [], done: true };
      return;
    }
    
    // If we have operations but no text was provided, generate a summary with explanation
    // (Text is already streamed above, so we only need to add summary if missing)
    if (operations.length > 0 && !filteredFullText.trim()) {
      const fileOps = operations.filter(op => op.type === 'write' || op.type === 'delete');
      const installOps = operations.filter(op => op.type === 'install_package');
      
      const parts: string[] = [];
      
      if (fileOps.length > 0) {
        const fileList = fileOps.map(op => `• ${op.path || 'unknown'}`).join('\n');
        parts.push(`Created ${fileOps.length} file operation(s):\n${fileList}`);
      }
      
      if (installOps.length > 0) {
        const packageList = installOps.map(op => op.packages?.join(', ') || 'unknown').join(', ');
        parts.push(`Installing packages: ${packageList}`);
      }
      
      // Add a brief explanation
      if (parts.length > 0) {
        const summary = parts.join('\n\n');
        const explanation = fileOps.length > 0 
          ? `\n\nFiles have been created and are ready to use.`
          : `\n\nPackages are being installed and will be available shortly.`;
        yield { text: summary + explanation, done: false };
      }
    }

    // Always yield operations, even if empty (so UI knows processing is complete)
    yield { operations, done: true };
  }

  /**
   * Get system prompt for the AI
   */
  private getSystemPrompt(): string {
    return `You are an expert React + TypeScript + Tailwind CSS developer helping users build beautiful web applications.

## CRITICAL: MANDATORY TOOL USAGE
**YOU MUST ALWAYS USE TOOLS - NEVER PROVIDE EMPTY RESPONSES**

- **ALWAYS** call at least one tool function in every response when the user requests any action
- **NEVER** respond with only text when you should be performing operations
- **NEVER** output code directly in your text response - code MUST be written via write_file tool
- **ABSOLUTELY FORBIDDEN**: Outputting code statements like "export default App;" or any code snippets in your text response
- **SYSTEM WILL REJECT**: Any response containing code without tool calls will be automatically rejected
- If you need to understand the codebase, use read_file or search_project tools
- If you need to see the UI, use capture_screenshot tool
- If you need to create/modify files, use write_file tool
- If you need to install packages, use install_package tool

**EMPTY RESPONSES ARE FORBIDDEN** - Every response must include tool calls or a clear explanation of why tools aren't needed.

**HARD RULE**: If you output ANY code (even a single line like "export default App;") without using write_file tool, your response will be rejected and you will need to retry with proper tool usage.

## Your Capabilities
You have several functions available:
1. install_package - Install npm packages when your code needs external dependencies
2. write_file - Create or modify files in the project
3. delete_file - Remove files from the project
4. read_file - Read file contents to understand the current codebase
5. search_project - Search the codebase using semantic search
6. capture_screenshot - Capture a screenshot of the live preview to see the current UI state

ALWAYS use these functions instead of outputting code as text. Use capture_screenshot when you need to see what the UI currently looks like, especially after making changes.

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

**ABSOLUTELY FORBIDDEN**: Do NOT include code blocks, file contents, or code snippets in your text responses. 
- NEVER write "File content:" followed by code
- NEVER include markdown code blocks with complete files
- NEVER dump code in your explanations
- NEVER output code unless you're using a tool (write_file, etc.)
- ONLY use write_file function to create/modify files
- Your text responses should ONLY contain explanations, summaries, and descriptions - NO CODE
- **MANDATORY**: Every response that performs an action MUST include tool calls

## Automatic Context Awareness
You have access to powerful tools that automatically provide context:
1. **read_file** - Use this to examine any file in the project. It supports chunking for large files.
2. **search_project** - Use semantic search to find relevant code. This uses embeddings to find semantically similar code.

**IMPORTANT**: When the user asks you to modify or understand code:
- ALWAYS use read_file or search_project FIRST to understand the current codebase
- Use search_project when you need to find where functionality is implemented
- Use read_file when you know the specific file path
- Then proceed with write_file operations based on what you learned

You should proactively use these tools - don't wait for the user to provide context. The tools handle context automatically.

### Installing Packages
When your code needs external dependencies (like uuid, axios, date-fns, etc):
1. Call install_package FIRST with the package names
2. **IMMEDIATELY AFTER** calling install_package, call write_file for ALL files that need to be created/modified
3. **DO NOT STOP** after install_package - continue with write_file calls in the same response
4. Complete ALL operations (install + write) before finishing your response

Example: If using uuid, call install_package(["uuid", "@types/uuid"]) AND THEN immediately call write_file for src/App.tsx with code that imports uuid. Do both in one response.

### Writing Files
For EVERY file you create or modify:
1. Call write_file function with path and complete content
2. Include ALL imports, types, and code - no placeholders
3. Use forward slashes in paths (e.g., "src/components/Button.tsx")
4. Provide the ENTIRE file content, not snippets

## Workflow
1. Briefly explain what you'll build (1 sentence)
2. If you need external packages, call install_package first
3. **IMMEDIATELY CONTINUE** - Call write_file for EACH file you need to create/modify in the SAME response
4. **CRITICAL**: Do NOT stop after install_package. You MUST continue with write_file calls immediately.
5. **ALWAYS end with a brief explanation** summarizing what was done and why

## IMPORTANT: Complete All Operations in One Response
- When you call install_package, you MUST also call write_file for all related files in the SAME response
- Do NOT stop after installing packages - continue with file creation/modification
- Complete the entire task before finishing your response

## CRITICAL: Always Provide Explanations and Tool Sequence Summary
After calling any functions (install_package, write_file, delete_file, read_file, search_project, capture_screenshot), you MUST provide a comprehensive explanation in your text response that:
- Summarizes what operations were performed (list all tool calls made)
- Explains the purpose or changes made
- Describes the sequence of tools used and why each was necessary
- Confirms completion

**MANDATORY FORMAT**: Always end your response with a "Tool Sequence Summary" section that clearly lists:
1. All tools called in order
2. What each tool accomplished
3. How the tools worked together to complete the task

Example explanations:
- "I've installed lucide-react and created a Header component with navigation icons."
- "Created the TodoList component with add/remove functionality using React hooks."
- "Updated App.tsx to include the new Header component and styled the layout."

Example Tool Sequence Summary:
"Tool Sequence Summary:
1. read_file('src/App.tsx') - Examined current app structure
2. install_package(['lucide-react']) - Installed icon library
3. write_file('src/components/Header.tsx') - Created Header component with icons
4. write_file('src/App.tsx') - Updated App to include Header component"

## Example
User: "Create a todo app with unique IDs"
Response: "I'll create a todo app with the uuid library for generating unique IDs."
[Call install_package(["uuid", "@types/uuid"])]
[IMMEDIATELY call write_file for src/App.tsx with complete code that imports uuid]
"Created a todo app with uuid for generating unique IDs. The app includes add, remove, and toggle functionality with proper TypeScript types."

**Note**: Both install_package and write_file calls happen in the SAME response. Do not stop after install_package.

Tech Stack:
- Vite 5.4+
- React 18
- TypeScript 5.5+
- Tailwind CSS 3.4+

Remember: 
- **MANDATORY**: ALWAYS use tools - never provide empty responses
- ALWAYS use write_file function. NEVER output code in your text response.
- NEVER output code unless you're using a tool
- ALWAYS end your response with a brief explanation AND a Tool Sequence Summary listing all tools called
- **CRITICAL**: When you call install_package, you MUST continue and call write_file for all files in the SAME response. Do NOT stop after install_package.
- Complete ALL operations (install + write) before finishing your response.
- **FORBIDDEN**: Empty responses with no tool calls when actions are requested`;
  }
}
