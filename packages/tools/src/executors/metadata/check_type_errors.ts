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

      return {
        success: true,
        output: {
          errors,
          warnings,
          hasErrors: errors.length > 0,
          hasWarnings: warnings.length > 0,
          totalErrors: errors.length,
          totalWarnings: warnings.length,
          truncated: errors.length >= MAX_ERRORS || (includeWarnings && warnings.length >= MAX_WARNINGS),
          rawOutput: output.substring(0, 5000), // Limit raw output size
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

