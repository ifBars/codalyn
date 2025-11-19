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
 * Apply patch executor - apply targeted changes to files
 */
export const applyPatchExecutor: ToolExecutor = {
  async execute(params: any, sandbox: SandboxInterface): Promise<ToolExecutionResult> {
    try {
      const schema = z.object({
        path: z.string(),
        changes: z.array(
          z.object({
            startLine: z.number().optional(),
            endLine: z.number().optional(),
            newContent: z.string().optional(),
            find: z.string().optional(),
            replace: z.string().optional(),
            replaceAll: z.boolean().optional().default(false),
          })
        ),
      });
      const { path, changes } = schema.parse(params);

      let content = await sandbox.readFile(path);
      const lines = content.split("\n");

      for (const change of changes) {
        if (change.startLine !== undefined && change.endLine !== undefined && change.newContent !== undefined) {
          // Line-based replacement
          const start = change.startLine - 1; // Convert to 0-indexed
          const end = change.endLine;
          const newLines = change.newContent.split("\n");
          lines.splice(start, end - start, ...newLines);
          content = lines.join("\n");
        } else if (change.find !== undefined && change.replace !== undefined) {
          // Text-based find/replace
          if (change.replaceAll) {
            content = content.split(change.find).join(change.replace);
          } else {
            content = content.replace(change.find, change.replace);
          }
        } else {
          return {
            success: false,
            error: "Each change must have either (startLine, endLine, newContent) or (find, replace)",
          };
        }
      }

      await sandbox.writeFile(path, content);
      return { success: true, output: { path, changesApplied: changes.length } };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : "Unknown error",
      };
    }
  },
};

/**
 * Find in files executor - search for text patterns
 */
export const findInFilesExecutor: ToolExecutor = {
  async execute(params: any, sandbox: SandboxInterface): Promise<ToolExecutionResult> {
    try {
      const schema = z.object({
        pattern: z.string(),
        path: z.string().optional().default("."),
        includePattern: z.string().optional(),
        excludePattern: z.string().optional(),
        caseSensitive: z.boolean().optional().default(true),
        maxResults: z.number().optional().default(100),
        contextLines: z.number().optional().default(2),
      });
      const parsed = schema.parse(params);

      // This is a complex operation that would require recursive file traversal
      // For now, return a message that this should use grep or similar tools
      return {
        success: false,
        error: "find_in_files requires integration with filesystem search tools. Consider using run_command with grep/ripgrep instead.",
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
 * Rename path executor
 */
export const renamePathExecutor: ToolExecutor = {
  async execute(params: any, sandbox: SandboxInterface): Promise<ToolExecutionResult> {
    try {
      const schema = z.object({
        oldPath: z.string(),
        newPath: z.string(),
      });
      const { oldPath, newPath } = schema.parse(params);

      // Read the old file, write to new location, delete old
      const content = await sandbox.readFile(oldPath);
      await sandbox.writeFile(newPath, content);
      await sandbox.deletePath(oldPath);

      return { success: true, output: { oldPath, newPath } };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : "Unknown error",
      };
    }
  },
};

/**
 * Copy path executor
 */
export const copyPathExecutor: ToolExecutor = {
  async execute(params: any, sandbox: SandboxInterface): Promise<ToolExecutionResult> {
    try {
      const schema = z.object({
        source: z.string(),
        destination: z.string(),
        recursive: z.boolean().optional().default(false),
      });
      const { source, destination } = schema.parse(params);

      const content = await sandbox.readFile(source);
      await sandbox.writeFile(destination, content);

      return { success: true, output: { source, destination } };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : "Unknown error",
      };
    }
  },
};

/**
 * Get file info executor
 */
export const getFileInfoExecutor: ToolExecutor = {
  async execute(params: any, sandbox: SandboxInterface): Promise<ToolExecutionResult> {
    try {
      const schema = z.object({
        path: z.string(),
      });
      const { path } = schema.parse(params);

      // This would require stat() functionality from sandbox
      // For now, we can at least check if file exists by trying to read it
      const content = await sandbox.readFile(path);
      return {
        success: true,
        output: {
          path,
          size: content.length,
          exists: true,
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
 * Create directory executor
 */
export const createDirectoryExecutor: ToolExecutor = {
  async execute(params: any, sandbox: SandboxInterface): Promise<ToolExecutionResult> {
    try {
      const schema = z.object({
        path: z.string(),
      });
      const { path } = schema.parse(params);

      // Directories are created implicitly when writing files in most sandboxes
      // We could use run_command with mkdir -p
      const process = await sandbox.runCommand(`mkdir -p "${path}"`);
      const reader = process.output.getReader();
      const chunks: string[] = [];
      let done = false;
      while (!done) {
        const { value, done: readerDone } = await reader.read();
        done = readerDone;
        if (value) chunks.push(value);
      }

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
 * Replace in file executor
 */
export const replaceInFileExecutor: ToolExecutor = {
  async execute(params: any, sandbox: SandboxInterface): Promise<ToolExecutionResult> {
    try {
      const schema = z.object({
        path: z.string(),
        find: z.string(),
        replace: z.string(),
        replaceAll: z.boolean().optional().default(true),
        regex: z.boolean().optional().default(false),
        caseSensitive: z.boolean().optional().default(true),
      });
      const { path, find, replace, replaceAll, regex, caseSensitive } = schema.parse(params);

      let content = await sandbox.readFile(path);

      if (regex) {
        const flags = (replaceAll ? "g" : "") + (caseSensitive ? "" : "i");
        const pattern = new RegExp(find, flags);
        content = content.replace(pattern, replace);
      } else {
        if (replaceAll) {
          if (caseSensitive) {
            content = content.split(find).join(replace);
          } else {
            const pattern = new RegExp(find.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"), "gi");
            content = content.replace(pattern, replace);
          }
        } else {
          if (caseSensitive) {
            content = content.replace(find, replace);
          } else {
            const pattern = new RegExp(find.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"), "i");
            content = content.replace(pattern, replace);
          }
        }
      }

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
 * Insert at line executor
 */
export const insertAtLineExecutor: ToolExecutor = {
  async execute(params: any, sandbox: SandboxInterface): Promise<ToolExecutionResult> {
    try {
      const schema = z.object({
        path: z.string(),
        line: z.number(),
        content: z.string(),
      });
      const { path, line, content } = schema.parse(params);

      const fileContent = await sandbox.readFile(path);
      const lines = fileContent.split("\n");

      if (line === 0) {
        lines.unshift(content);
      } else if (line === -1) {
        lines.push(content);
      } else {
        lines.splice(line - 1, 0, content);
      }

      await sandbox.writeFile(path, lines.join("\n"));
      return { success: true, output: { path, line } };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : "Unknown error",
      };
    }
  },
};

/**
 * Append to file executor
 */
export const appendToFileExecutor: ToolExecutor = {
  async execute(params: any, sandbox: SandboxInterface): Promise<ToolExecutionResult> {
    try {
      const schema = z.object({
        path: z.string(),
        content: z.string(),
        newline: z.boolean().optional().default(true),
      });
      const { path, content, newline } = schema.parse(params);

      let fileContent = await sandbox.readFile(path);
      if (newline && !fileContent.endsWith("\n")) {
        fileContent += "\n";
      }
      fileContent += content;

      await sandbox.writeFile(path, fileContent);
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
 * Read lines executor
 */
export const readLinesExecutor: ToolExecutor = {
  async execute(params: any, sandbox: SandboxInterface): Promise<ToolExecutionResult> {
    try {
      const schema = z.object({
        path: z.string(),
        startLine: z.number(),
        endLine: z.number().optional(),
      });
      const { path, startLine, endLine } = schema.parse(params);

      const content = await sandbox.readFile(path);
      const lines = content.split("\n");

      const start = startLine - 1; // Convert to 0-indexed
      const end = endLine ? endLine : lines.length;

      const selectedLines = lines.slice(start, end);

      return {
        success: true,
        output: {
          lines: selectedLines,
          content: selectedLines.join("\n"),
          startLine,
          endLine: end,
          totalLines: lines.length,
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
 * npm install executor
 */
export const npmInstallExecutor: ToolExecutor = {
  async execute(params: any, sandbox: SandboxInterface): Promise<ToolExecutionResult> {
    try {
      const schema = z.object({
        packages: z.array(z.string()),
        dev: z.boolean().optional().default(false),
      });
      const { packages, dev } = schema.parse(params);

      if (!packages || packages.length === 0) {
        return {
          success: false,
          error: "No packages specified for installation",
        };
      }

      // Check if sandbox supports installPackage method
      if (!sandbox.installPackage) {
        // Fallback to runCommand if installPackage is not available
        const command = `npm install ${dev ? '--save-dev' : '--save'} ${packages.join(' ')}`;
        const process = await sandbox.runCommand(command, { timeout: 120000 });
        
        // Read output
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
            packages,
            output: chunks.join(""),
          },
        };
      }

      // Use sandbox's installPackage method (preferred for WebContainer)
      const result = await sandbox.installPackage(packages, { dev });
      
      return {
        success: result.success,
        output: result.output || `Installed packages: ${packages.join(', ')}`,
        error: result.error,
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
  ["read_lines", readLinesExecutor],
  ["write_file", writeFileExecutor],
  ["append_to_file", appendToFileExecutor],
  ["insert_at_line", insertAtLineExecutor],
  ["apply_patch", applyPatchExecutor],
  ["replace_in_file", replaceInFileExecutor],
  ["list_directory", listDirectoryExecutor],
  ["create_directory", createDirectoryExecutor],
  ["rename_path", renamePathExecutor],
  ["copy_path", copyPathExecutor],
  ["get_file_info", getFileInfoExecutor],
  ["find_in_files", findInFilesExecutor],
  ["run_command", runCommandExecutor],
  ["npm_install", npmInstallExecutor],
]);

export function getExecutor(toolName: string): ToolExecutor | undefined {
  return executorRegistry.get(toolName);
}

