import { ToolExecutor } from "../types";
import { SandboxInterface } from "@codalyn/sandbox";
import { z } from "zod";

/**
 * Check TypeScript type errors executor
 * Runs TypeScript compiler to check for type errors
 */
export const checkTypeErrorsExecutor: ToolExecutor = {
  async execute(params: any, sandbox: SandboxInterface) {
    try {
      const schema = z.object({
        includeWarnings: z.boolean().optional().default(false),
      });
      
      const { includeWarnings } = schema.parse(params);

      // Check if tsconfig.json exists
      let hasTsConfig = false;
      try {
        await sandbox.readFile("tsconfig.json");
        hasTsConfig = true;
      } catch {
        // No tsconfig.json, might not be a TypeScript project
        return {
          success: true,
          output: {
            errors: [],
            warnings: [],
            hasErrors: false,
            message: "No tsconfig.json found. This may not be a TypeScript project.",
          },
        };
      }

      // Run TypeScript compiler with optimized flags for speed
      // --skipLibCheck: Skip type checking of declaration files (much faster)
      // --incremental false: Don't use incremental compilation
      // --pretty false: Disable pretty output for faster parsing
      const command = includeWarnings 
        ? "npx tsc --noEmit --skipLibCheck --incremental false" 
        : "npx tsc --noEmit --skipLibCheck --incremental false --pretty false";
      
      const process = await sandbox.runCommand(command, { 
        timeout: 10000, // Reduced from 30s to 10s
      });

      // Read output with timeout protection
      const reader = process.output.getReader();
      const chunks: string[] = [];
      let done = false;
      const readTimeout = setTimeout(() => {
        reader.cancel();
        done = true;
      }, 8000); // Cancel reading after 8 seconds

      try {
        while (!done) {
          const { value, done: readerDone } = await reader.read();
          done = readerDone;
          if (value) {
            chunks.push(value);
            // Limit output size to prevent memory issues
            if (chunks.join("").length > 100000) {
              chunks.push("\n... (output truncated)");
              break;
            }
          }
        }
      } finally {
        clearTimeout(readTimeout);
        reader.releaseLock();
      }

      const output = chunks.join("");
      let exitCode: number | null = null;
      try {
        const exitPromise = 'exit' in process ? process.exit : undefined;
        if (exitPromise) {
          const result = await Promise.race([
            exitPromise,
            new Promise<number>((resolve) => setTimeout(() => resolve(-1), 2000))
          ]);
          exitCode = typeof result === 'number' ? result : -1;
        } else {
          // If exit promise doesn't exist, assume non-zero if we have output
          exitCode = output.trim() ? -1 : 0;
        }
      } catch {
        exitCode = -1; // Timeout or error getting exit code
      }

      // Parse TypeScript compiler output
      const errors: Array<{
        file: string;
        line: number;
        column: number;
        message: string;
        code: string;
      }> = [];

      const warnings: Array<{
        file: string;
        line: number;
        column: number;
        message: string;
        code: string;
      }> = [];

      // Limit number of errors parsed to prevent slowdown
      const MAX_ERRORS = 50;
      const MAX_WARNINGS = 20;

      if (exitCode !== 0 || output.trim()) {
        // Parse TypeScript error format:
        // file.ts(line,column): error TS1234: Error message
        // or
        // file.ts:line:column - error TS1234: Error message
        const lines = output.split("\n");
        let currentFile = "";
        
        for (const line of lines) {
          // Stop parsing if we've reached the limit
          if (errors.length >= MAX_ERRORS && (!includeWarnings || warnings.length >= MAX_WARNINGS)) {
            break;
          }

          // Match TypeScript error format
          const errorMatch = line.match(/^(.+?)\((\d+),(\d+)\):\s*(error|warning)\s+(TS\d+):\s*(.+)$/);
          if (errorMatch) {
            const [, file, lineNum, colNum, type, code, message] = errorMatch;
            const error = {
              file: file.trim(),
              line: parseInt(lineNum, 10),
              column: parseInt(colNum, 10),
              message: message.trim(),
              code: code.trim(),
            };
            
            if (type === "error" && errors.length < MAX_ERRORS) {
              errors.push(error);
            } else if (includeWarnings && warnings.length < MAX_WARNINGS) {
              warnings.push(error);
            }
            currentFile = file.trim();
            continue;
          }

          // Try alternative format: file.ts:line:column - error TS1234: message
          const altMatch = line.match(/^(.+?):(\d+):(\d+)\s*-\s*(error|warning)\s+(TS\d+):\s*(.+)$/);
          if (altMatch) {
            const [, file, lineNum, colNum, type, code, message] = altMatch;
            const error = {
              file: file.trim(),
              line: parseInt(lineNum, 10),
              column: parseInt(colNum, 10),
              message: message.trim(),
              code: code.trim(),
            };
            
            if (type === "error" && errors.length < MAX_ERRORS) {
              errors.push(error);
            } else if (includeWarnings && warnings.length < MAX_WARNINGS) {
              warnings.push(error);
            }
            currentFile = file.trim();
            continue;
          }

          // If we have a current file and this line doesn't match, it might be a continuation
          if (currentFile && line.trim() && !line.match(/^\s*$/)) {
            // This might be a continuation of the previous error message
            if (errors.length > 0) {
              errors[errors.length - 1].message += " " + line.trim();
            } else if (warnings.length > 0) {
              warnings[warnings.length - 1].message += " " + line.trim();
            }
          }
        }
      }

      // Also check console logs for build errors (Vite, etc.)
      const buildErrors: Array<{
        file: string;
        line: number;
        column: number;
        message: string;
        code: string;
      }> = [];

      try {
        const consoleLogs = await sandbox.getConsoleLogs({
          level: 'error',
          limit: 100,
          since: Date.now() - 60000, // Check logs from last minute
        });

        for (const log of consoleLogs) {
          if (buildErrors.length >= MAX_ERRORS) break;
          
          const message = log.message || '';
          
          // Skip if already processed (avoid duplicates)
          const alreadyProcessed = buildErrors.some(e => 
            e.message.includes(message.substring(0, 50)) || 
            message.includes(e.message.substring(0, 50))
          );
          if (alreadyProcessed) continue;
          
          // Parse Vite import errors first (most specific)
          // Format: "Failed to resolve import "./Header" from "src/App.tsx". Does the file exist?"
          // Also handles: "[vite] Internal server error: Failed to resolve import..."
          const viteImportError = message.match(/Failed to resolve import\s+["'](.+?)["']\s+from\s+["'](.+?)["']/i);
          if (viteImportError) {
            const [, importPath, file] = viteImportError;
            // Try to extract line number if present in the message
            const lineMatch = message.match(/File:\s*.+?:(\d+):(\d+)/i);
            buildErrors.push({
              file: file.trim(),
              line: lineMatch ? parseInt(lineMatch[1], 10) : 0,
              column: lineMatch ? parseInt(lineMatch[2], 10) : 0,
              message: `Failed to resolve import "${importPath}"${message.includes('Does the file exist') ? '. Does the file exist?' : ''}`,
              code: 'VITE_IMPORT_ERROR',
            });
            continue;
          }

          // Parse Vite internal server errors (less specific, but still structured)
          // Format: "[vite] Internal server error: ..."
          const viteServerError = message.match(/\[vite\]\s*Internal\s+server\s+error[:\s]+(.+)/i);
          if (viteServerError) {
            const errorMsg = viteServerError[1].trim();
            // Try to extract file path from error message
            const fileMatch = errorMsg.match(/from\s+["'](.+?)["']/i) || errorMsg.match(/File:\s*(.+?)(?:\s|$)/i);
            const lineMatch = errorMsg.match(/File:\s*.+?:(\d+):(\d+)/i);
            buildErrors.push({
              file: fileMatch ? fileMatch[1].trim() : 'unknown',
              line: lineMatch ? parseInt(lineMatch[1], 10) : 0,
              column: lineMatch ? parseInt(lineMatch[2], 10) : 0,
              message: errorMsg.substring(0, 500),
              code: 'VITE_SERVER_ERROR',
            });
            continue;
          }

          // Parse generic error patterns with file paths
          // Format: "File: /path/to/file.tsx:2:19"
          const fileErrorMatch = message.match(/File:\s*(.+?):(\d+):(\d+)/i);
          if (fileErrorMatch && message.toLowerCase().includes('error')) {
            const [, file, lineNum, colNum] = fileErrorMatch;
            buildErrors.push({
              file: file.trim(),
              line: parseInt(lineNum, 10),
              column: parseInt(colNum, 10),
              message: message.substring(0, 500),
              code: 'BUILD_ERROR',
            });
            continue;
          }

          // If it's an error log but doesn't match specific patterns, still include it
          if (message.toLowerCase().includes('error') && 
              !message.toLowerCase().includes('typescript') &&
              !message.toLowerCase().includes('tsc')) {
            // Try to extract file path
            const anyFileMatch = message.match(/["'](.+?\.(tsx?|jsx?))["']/i);
            buildErrors.push({
              file: anyFileMatch ? anyFileMatch[1] : 'unknown',
              line: 0,
              column: 0,
              message: message.substring(0, 500),
              code: 'BUILD_ERROR',
            });
          }
        }
      } catch (logError) {
        // If we can't get console logs, continue with TypeScript errors only
        console.warn('[checkTypeErrors] Failed to get console logs:', logError);
      }

      // Combine TypeScript errors and build errors
      const allErrors = [...errors, ...buildErrors];
      const hasAnyErrors = allErrors.length > 0;

      return {
        success: true,
        output: {
          errors: allErrors,
          warnings,
          hasErrors: hasAnyErrors,
          hasWarnings: warnings.length > 0,
          totalErrors: allErrors.length,
          totalWarnings: warnings.length,
          truncated: allErrors.length >= MAX_ERRORS || (includeWarnings && warnings.length >= MAX_WARNINGS),
          rawOutput: output.substring(0, 5000), // Limit raw output size
          buildErrors: buildErrors.length > 0 ? buildErrors : undefined,
          typeErrors: errors.length > 0 ? errors : undefined,
        },
      };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : "Unknown error",
      };
    }
  },
};

