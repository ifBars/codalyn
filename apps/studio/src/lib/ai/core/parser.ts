/**
 * Enhanced AI response parsing utilities
 * Provides robust parsing, validation, and normalization of AI responses
 */

import { ToolCall, ToolResult, FileOperation } from "./types";

/**
 * Normalize and validate a tool call
 */
export function normalizeToolCall(toolCall: any): ToolCall | null {
  if (!toolCall || typeof toolCall !== "object") {
    return null;
  }

  const name = String(toolCall.name || "").trim();
  if (!name) {
    return null;
  }

  // Normalize args - ensure it's an object
  let args: Record<string, any> = {};
  if (toolCall.args) {
    if (typeof toolCall.args === "object" && !Array.isArray(toolCall.args)) {
      args = { ...toolCall.args };
    } else {
      // Try to parse if it's a string
      try {
        args = typeof toolCall.args === "string" ? JSON.parse(toolCall.args) : {};
      } catch {
        args = {};
      }
    }
  }

  return {
    id: toolCall.id || undefined,
    name,
    args,
  };
}

/**
 * Normalize and validate a tool result
 */
export function normalizeToolResult(toolResult: any): ToolResult | null {
  if (!toolResult || typeof toolResult !== "object") {
    return null;
  }

  const name = String(toolResult.name || "").trim();
  if (!name) {
    return null;
  }

  return {
    toolCallId: toolResult.toolCallId || undefined,
    name,
    result: toolResult.result,
    error: toolResult.error || undefined,
    success: Boolean(toolResult.success),
  };
}

/**
 * Match tool calls with their results using IDs and positional matching
 */
export function matchToolCallsWithResults(
  toolCalls: ToolCall[],
  toolResults: ToolResult[]
): Map<ToolCall, ToolResult | null> {
  const matches = new Map<ToolCall, ToolResult | null>();

  // First pass: match by toolCallId
  const unmatchedResults = new Set(toolResults);
  const matchedResultIds = new Set<string>();

  for (const toolCall of toolCalls) {
    if (toolCall.id) {
      const matchingResult = Array.from(unmatchedResults).find(
        (result) => result.toolCallId === toolCall.id
      );
      if (matchingResult) {
        matches.set(toolCall, matchingResult);
        unmatchedResults.delete(matchingResult);
        matchedResultIds.add(matchingResult.toolCallId || "");
      } else {
        matches.set(toolCall, null);
      }
    }
  }

  // Second pass: match by name and position for unmatched calls/results
  const unmatchedCalls = toolCalls.filter((call) => !matches.has(call));
  const stillUnmatchedResults = Array.from(unmatchedResults);

  for (let i = 0; i < unmatchedCalls.length && i < stillUnmatchedResults.length; i++) {
    const call = unmatchedCalls[i];
    const result = stillUnmatchedResults[i];
    
    // Only match if names match (helps ensure correctness)
    if (call.name === result.name) {
      matches.set(call, result);
      stillUnmatchedResults.splice(i, 1);
    } else {
      matches.set(call, null);
    }
  }

  // Mark remaining unmatched calls
  for (const call of unmatchedCalls) {
    if (!matches.has(call)) {
      matches.set(call, null);
    }
  }

  return matches;
}

/**
 * Extract file operations from tool calls and results
 * Handles multiple tool name variations and validates inputs
 */
export function extractFileOperations(
  toolCalls: ToolCall[],
  toolResults: ToolResult[]
): FileOperation[] {
  const operations: FileOperation[] = [];
  const matches = matchToolCallsWithResults(toolCalls, toolResults);

  for (const [toolCall, toolResult] of matches) {
    // Only process successful operations or operations without results
    if (toolResult && !toolResult.success) {
      continue;
    }

    try {
      // Handle write_file
      if (toolCall.name === "write_file") {
        const path = toolCall.args?.path;
        const content = toolCall.args?.content;

        if (path && typeof path === "string" && path.trim()) {
          // Content can be empty string, but must be defined
          if (content !== undefined && content !== null) {
            operations.push({
              type: "write",
              path: normalizePath(path),
              content: String(content),
            });
          }
        }
      }
      // Handle delete operations (multiple name variations)
      else if (
        toolCall.name === "delete_path" ||
        toolCall.name === "delete_file" ||
        toolCall.name === "delete"
      ) {
        const path = toolCall.args?.path || toolCall.args?.filePath;
        if (path && typeof path === "string" && path.trim()) {
          operations.push({
            type: "delete",
            path: normalizePath(path),
          });
        }
      }
      // Handle npm install
      else if (toolCall.name === "npm_install" || toolCall.name === "npmInstall") {
        const packages = toolCall.args?.packages || toolCall.args?.package || toolCall.args?.dependencies;
        
        // Handle both array and single string
        let packageList: string[] = [];
        if (Array.isArray(packages)) {
          packageList = packages.map(String).filter((p) => p.trim());
        } else if (typeof packages === "string" && packages.trim()) {
          // Try to parse comma-separated or space-separated
          packageList = packages
            .split(/[,\s]+/)
            .map((p) => p.trim())
            .filter((p) => p);
        }

        if (packageList.length > 0) {
          operations.push({
            type: "install_package",
            packages: packageList,
          });
        }
      }
    } catch (error) {
      console.warn(`[Parser] Error extracting operation from ${toolCall.name}:`, error);
      // Continue processing other operations
    }
  }

  return operations;
}

/**
 * Normalize file paths (remove leading/trailing slashes, normalize separators)
 */
function normalizePath(path: string): string {
  return path
    .trim()
    .replace(/^\/+/, "") // Remove leading slashes
    .replace(/\\/g, "/") // Normalize separators
    .replace(/\/+/g, "/"); // Collapse multiple slashes
}

/**
 * Parse tool calls from various response formats
 * Handles both direct tool calls and nested structures
 */
export function parseToolCalls(response: any): ToolCall[] {
  const toolCalls: ToolCall[] = [];

  if (!response) {
    return toolCalls;
  }

  // Handle direct array of tool calls
  if (Array.isArray(response.toolCalls)) {
    for (const call of response.toolCalls) {
      const normalized = normalizeToolCall(call);
      if (normalized) {
        toolCalls.push(normalized);
      }
    }
  }

  // Handle functionCalls property (Gemini format)
  if (Array.isArray((response as any).functionCalls)) {
    for (const call of (response as any).functionCalls) {
      const normalized = normalizeToolCall({
        name: call.name,
        args: call.args,
        id: call.id,
      });
      if (normalized) {
        toolCalls.push(normalized);
      }
    }
  }

  // Handle nested in candidates (Gemini format)
  if (response.candidates && Array.isArray(response.candidates)) {
    for (const candidate of response.candidates) {
      if (candidate.content?.parts) {
        for (const part of candidate.content.parts) {
          if (part.functionCall) {
            const normalized = normalizeToolCall({
              name: part.functionCall.name,
              args: part.functionCall.args,
              id: part.functionCall.id,
            });
            if (normalized) {
              toolCalls.push(normalized);
            }
          }
        }
      }
    }
  }

  return toolCalls;
}

/**
 * Parse tool results from various formats
 */
export function parseToolResults(results: any[]): ToolResult[] {
  const toolResults: ToolResult[] = [];

  if (!Array.isArray(results)) {
    return toolResults;
  }

  for (const result of results) {
    const normalized = normalizeToolResult(result);
    if (normalized) {
      toolResults.push(normalized);
    }
  }

  return toolResults;
}

/**
 * Validate file operation before execution
 */
export function validateFileOperation(op: FileOperation): {
  valid: boolean;
  error?: string;
} {
  if (op.type === "write") {
    if (!op.path || !op.path.trim()) {
      return { valid: false, error: "Write operation missing path" };
    }
    if (op.content === undefined || op.content === null) {
      return { valid: false, error: "Write operation missing content" };
    }
  } else if (op.type === "delete") {
    if (!op.path || !op.path.trim()) {
      return { valid: false, error: "Delete operation missing path" };
    }
  } else if (op.type === "install_package") {
    if (!op.packages || !Array.isArray(op.packages) || op.packages.length === 0) {
      return { valid: false, error: "Install operation missing packages" };
    }
    // Validate package names
    for (const pkg of op.packages) {
      if (!pkg || typeof pkg !== "string" || !pkg.trim()) {
        return { valid: false, error: `Invalid package name: ${pkg}` };
      }
    }
  } else {
    return { valid: false, error: `Unknown operation type: ${op.type}` };
  }

  return { valid: true };
}

/**
 * Filter and validate file operations
 */
export function filterValidFileOperations(operations: FileOperation[]): FileOperation[] {
  return operations.filter((op) => {
    const validation = validateFileOperation(op);
    if (!validation.valid) {
      console.warn(`[Parser] Invalid operation filtered: ${validation.error}`, op);
    }
    return validation.valid;
  });
}

