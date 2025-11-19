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
 * Read file executor with chunking support
 */
export const readFileExecutor: ToolExecutor = {
  async execute(params: any, sandbox: SandboxInterface): Promise<ToolExecutionResult> {
    try {
      const schema = z.object({
        path: z.string(),
        chunk: z.boolean().optional().default(false),
        chunkIndex: z.number().optional(),
        maxChunkSize: z.number().optional().default(1000),
      });
      const { path, chunk, chunkIndex, maxChunkSize } = schema.parse(params);
      
      const content = await sandbox.readFile(path);
      
      if (!chunk) {
        return { success: true, output: content };
      }

      // Chunk the content
      const chunks = chunkText(content, maxChunkSize);
      
      if (chunkIndex !== undefined) {
        if (chunkIndex < 0 || chunkIndex >= chunks.length) {
          return {
            success: false,
            error: `Chunk index ${chunkIndex} out of range. File has ${chunks.length} chunks.`,
          };
        }
        return {
          success: true,
          output: {
            chunk: chunks[chunkIndex],
            chunkIndex,
            totalChunks: chunks.length,
            path,
          },
        };
      }

      // Return all chunks
      return {
        success: true,
        output: {
          chunks,
          totalChunks: chunks.length,
          path,
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
 * Helper function to chunk text
 */
function chunkText(content: string, maxChunkSize: number = 1000, overlap: number = 200): string[] {
  const chunks: string[] = [];
  const lines = content.split("\n");
  let currentChunk = "";

  for (const line of lines) {
    if (currentChunk.length + line.length > maxChunkSize && currentChunk.length > 0) {
      chunks.push(currentChunk.trim());
      const overlapText = currentChunk.slice(-overlap);
      currentChunk = overlapText + "\n" + line;
    } else {
      currentChunk += (currentChunk ? "\n" : "") + line;
    }
  }

  if (currentChunk.trim().length > 0) {
    chunks.push(currentChunk.trim());
  }

  return chunks.length > 0 ? chunks : [content];
}

/**
 * Search project executor (requires vector store - will be implemented in client)
 */
export const searchProjectExecutor: ToolExecutor = {
  async execute(params: any, sandbox: SandboxInterface): Promise<ToolExecutionResult> {
    // This executor will be handled by the client-side vector store
    // For now, return an error indicating it needs client-side implementation
    return {
      success: false,
      error: "search_project requires client-side vector store. This tool is handled automatically by the AI client.",
    };
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

