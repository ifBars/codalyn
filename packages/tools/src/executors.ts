/**
 * Tool executors - implement actual tool execution logic
 */

import { SandboxInterface } from "@codalyn/sandbox";
import { z } from "zod";

export interface ToolExecutionResult {
  success: boolean;
  output?: any;
  error?: string;
}

export interface ToolExecutor {
  execute(params: any, sandbox: SandboxInterface): Promise<ToolExecutionResult>;
}

/**
 * Read file executor
 */
export const readFileExecutor: ToolExecutor = {
  async execute(params: any, sandbox: SandboxInterface): Promise<ToolExecutionResult> {
    try {
      const schema = z.object({ path: z.string() });
      const { path } = schema.parse(params);
      const content = await sandbox.readFile(path);
      return { success: true, output: content };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : "Unknown error",
      };
    }
  },
};

/**
 * Write file executor
 */
export const writeFileExecutor: ToolExecutor = {
  async execute(params: any, sandbox: SandboxInterface): Promise<ToolExecutionResult> {
    try {
      const schema = z.object({
        path: z.string(),
        content: z.string(),
      });
      const { path, content } = schema.parse(params);
      await sandbox.writeFile(path, content);
      return { success: true, output: { path } };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : "Unknown error",
      };
    }
  },
};

/**
 * List directory executor
 */
export const listDirectoryExecutor: ToolExecutor = {
  async execute(params: any, sandbox: SandboxInterface): Promise<ToolExecutionResult> {
    try {
      const schema = z.object({ path: z.string().optional() });
      const { path = "." } = schema.parse(params);
      const entries = await sandbox.readdir(path);
      return { success: true, output: entries };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : "Unknown error",
      };
    }
  },
};

/**
 * Run command executor
 */
export const runCommandExecutor: ToolExecutor = {
  async execute(params: any, sandbox: SandboxInterface): Promise<ToolExecutionResult> {
    try {
      const schema = z.object({
        command: z.string(),
        cwd: z.string().optional(),
        env: z.record(z.string()).optional(),
        timeout: z.number().optional(),
        background: z.boolean().optional(),
      });
      const parsed = schema.parse(params);
      const process = await sandbox.runCommand(parsed.command, {
        cwd: parsed.cwd,
        env: parsed.env,
        timeout: parsed.timeout,
        background: parsed.background,
      });

      // Read output stream
      const reader = process.output.getReader();
      const chunks: string[] = [];
      let done = false;
      while (!done) {
        const { value, done: readerDone } = await reader.read();
        done = readerDone;
        if (value) {
          chunks.push(value);
        }
      }

      return {
        success: true,
        output: {
          processId: process.id,
          output: chunks.join(""),
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

/**
 * Executor registry
 */
export const executorRegistry: Map<string, ToolExecutor> = new Map([
  ["read_file", readFileExecutor],
  ["write_file", writeFileExecutor],
  ["list_directory", listDirectoryExecutor],
  ["run_command", runCommandExecutor],
  // More executors to be added...
]);

export function getExecutor(toolName: string): ToolExecutor | undefined {
  return executorRegistry.get(toolName);
}

