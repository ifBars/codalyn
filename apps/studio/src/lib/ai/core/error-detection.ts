/**
 * Error detection and reporting utilities for the AI agent
 */

import type { ToolSet, ToolCall, ToolResult } from "./types";

/**
 * Structured error information
 */
export interface TypeError {
  file: string;
  line: number;
  column: number;
  message: string;
  code: string;
}

export interface BuildError {
  file?: string;
  line?: number;
  message: string;
  type: "compilation" | "dependency" | "syntax" | "other";
}

export interface RuntimeError {
  message: string;
  stack?: string;
  file?: string;
  line?: number;
}

export interface ErrorReport {
  typeErrors: TypeError[];
  buildErrors: BuildError[];
  runtimeErrors: RuntimeError[];
  hasErrors: boolean;
  summary: string;
}

/**
 * Check for errors in the codebase
 * Runs type checking and checks console logs for build/runtime errors
 */
export async function checkForErrors(
  tools: ToolSet
): Promise<ErrorReport> {
  const report: ErrorReport = {
    typeErrors: [],
    buildErrors: [],
    runtimeErrors: [],
    hasErrors: false,
    summary: "",
  };

  // Check for TypeScript type errors
  try {
    const typeCheckCall: ToolCall = {
      name: "check_type_errors",
      args: { includeWarnings: false },
    };
    const typeCheckResult = await tools.execute(typeCheckCall);
    
    if (typeCheckResult.success && typeCheckResult.result?.output) {
      const output = typeCheckResult.result.output;
      if (output.hasErrors && output.errors) {
        report.typeErrors = output.errors.map((err: any) => ({
          file: err.file || "unknown",
          line: err.line || 0,
          column: err.column || 0,
          message: err.message || "Unknown error",
          code: err.code || "TS0000",
        }));
      }
    }
  } catch (error) {
    console.warn("[Error Detection] Failed to check type errors:", error);
  }

  // Check console logs for build and runtime errors
  try {
    const consoleLogsCall: ToolCall = {
      name: "get_console_logs",
      args: { level: "error", limit: 100 },
    };
    const consoleLogsResult = await tools.execute(consoleLogsCall);
    
    if (consoleLogsResult.success && consoleLogsResult.result?.output?.logs) {
      const logs = consoleLogsResult.result.output.logs;
      
      for (const log of logs) {
        const message = log.message || log.content || "";
        const level = log.level || "error";
        
        if (level === "error" || level === "warn") {
          // Check for build/compilation errors
          if (
            message.includes("Failed to resolve import") ||
            message.includes("Cannot find module") ||
            message.includes("Module not found") ||
            message.includes("dependencies are imported but could not be resolved") ||
            message.includes("The following dependencies") ||
            message.includes("Are they installed?")
          ) {
            report.buildErrors.push({
              message,
              type: "dependency",
            });
          } else if (
            message.includes("SyntaxError") ||
            message.includes("Unexpected token") ||
            message.includes("Parsing error")
          ) {
            report.buildErrors.push({
              message,
              type: "syntax",
            });
          } else if (
            message.includes("Internal server error") ||
            message.includes("500") ||
            message.includes("failed to load config") ||
            message.includes("server restart failed")
          ) {
            report.buildErrors.push({
              message,
              type: "compilation",
            });
          } else if (
            message.includes("Uncaught") ||
            message.includes("Unhandled") ||
            message.includes("ReferenceError") ||
            message.includes("TypeError") ||
            message.includes("Error:")
          ) {
            // Runtime error
            const stack = log.stack || "";
            const fileMatch = stack.match(/at\s+.+?\((.+?):(\d+):(\d+)\)/);
            
            report.runtimeErrors.push({
              message,
              stack,
              file: fileMatch ? fileMatch[1] : undefined,
              line: fileMatch ? parseInt(fileMatch[2], 10) : undefined,
            });
          } else {
            // Other build error
            report.buildErrors.push({
              message,
              type: "other",
            });
          }
        }
      }
    }
  } catch (error) {
    console.warn("[Error Detection] Failed to check console logs:", error);
  }

  // Determine if there are any errors
  report.hasErrors =
    report.typeErrors.length > 0 ||
    report.buildErrors.length > 0 ||
    report.runtimeErrors.length > 0;

  // Generate summary
  const parts: string[] = [];
  if (report.typeErrors.length > 0) {
    parts.push(`${report.typeErrors.length} type error(s)`);
  }
  if (report.buildErrors.length > 0) {
    parts.push(`${report.buildErrors.length} build error(s)`);
  }
  if (report.runtimeErrors.length > 0) {
    parts.push(`${report.runtimeErrors.length} runtime error(s)`);
  }
  
  if (parts.length > 0) {
    report.summary = `Found ${parts.join(", ")}`;
  } else {
    report.summary = "No errors found";
  }

  return report;
}

/**
 * Format errors into a prompt for the AI to fix them
 */
export function formatErrorsForAI(errorReport: ErrorReport): string {
  if (!errorReport.hasErrors) {
    return "";
  }

  const parts: string[] = [];
  parts.push("⚠️ ERRORS DETECTED - Please fix the following issues:\n");

  // Type errors
  if (errorReport.typeErrors.length > 0) {
    parts.push("## TypeScript Type Errors:\n");
    for (const error of errorReport.typeErrors) {
      parts.push(
        `- **${error.file}** (line ${error.line}, col ${error.column}): ${error.message} [${error.code}]`
      );
    }
    parts.push("");
  }

  // Build errors
  if (errorReport.buildErrors.length > 0) {
    parts.push("## Build Errors:\n");
    for (const error of errorReport.buildErrors) {
      if (error.file && error.line) {
        parts.push(`- **${error.file}** (line ${error.line}): ${error.message}`);
      } else {
        parts.push(`- ${error.message}`);
      }
    }
    parts.push("");
  }

  // Runtime errors
  if (errorReport.runtimeErrors.length > 0) {
    parts.push("## Runtime Errors:\n");
    for (const error of errorReport.runtimeErrors) {
      parts.push(`- ${error.message}`);
      if (error.file && error.line) {
        parts.push(`  Location: ${error.file}:${error.line}`);
      }
      if (error.stack) {
        const stackLines = error.stack.split("\n").slice(0, 3);
        parts.push(`  Stack: ${stackLines.join(" ")}`);
      }
    }
    parts.push("");
  }

  parts.push(
    "Please fix all these errors to ensure the application builds and runs correctly."
  );

  return parts.join("\n");
}

