/**
 * Tool definitions with JSON Schema for AI function calling
 */

import { z } from "zod";

export const ToolDefinitionSchema = z.object({
  name: z.string(),
  description: z.string(),
  parameters: z.record(z.any()), // JSON Schema
  examples: z.array(z.object({ input: z.any(), output: z.any() })).optional(),
});

export type ToolDefinition = z.infer<typeof ToolDefinitionSchema>;

/**
 * Filesystem tools
 */
export const readFileTool: ToolDefinition = {
  name: "read_file",
  description: "Read the contents of a file from the workspace. Supports chunking for large files. Use this to examine project files before making changes.",
  parameters: {
    type: "object",
    properties: {
      path: {
        type: "string",
        description: "Path to the file relative to workspace root",
      },
      chunk: {
        type: "boolean",
        description: "If true, return file in chunks (useful for large files). Default: false",
        default: false,
      },
      chunkIndex: {
        type: "number",
        description: "If chunking is enabled, specify which chunk to read (0-indexed). If not specified, returns all chunks.",
      },
      maxChunkSize: {
        type: "number",
        description: "Maximum size of each chunk in characters (default: 1000). Only used when chunk=true",
        default: 1000,
      },
    },
    required: ["path"],
  },
};

export const searchProjectTool: ToolDefinition = {
  name: "search_project",
  description: "Search the project codebase using semantic search. Use this to find relevant files and code snippets based on natural language queries. The search uses embeddings to find semantically similar code.",
  parameters: {
    type: "object",
    properties: {
      query: {
        type: "string",
        description: "Natural language search query describing what you're looking for (e.g., 'authentication logic', 'API route handlers', 'component state management')",
      },
      limit: {
        type: "number",
        description: "Maximum number of results to return (default: 5)",
        default: 5,
      },
    },
    required: ["query"],
  },
};

export const writeFileTool: ToolDefinition = {
  name: "write_file",
  description: "Write or create a file in the workspace",
  parameters: {
    type: "object",
    properties: {
      path: {
        type: "string",
        description: "Path to the file relative to workspace root",
      },
      content: {
        type: "string",
        description: "Full content of the file to write",
      },
    },
    required: ["path", "content"],
  },
};

export const listDirectoryTool: ToolDefinition = {
  name: "list_directory",
  description: "List files and directories in a directory",
  parameters: {
    type: "object",
    properties: {
      path: {
        type: "string",
        description: "Path to the directory relative to workspace root",
        default: ".",
      },
    },
    required: [],
  },
};

export const deletePathTool: ToolDefinition = {
  name: "delete_path",
  description: "Delete a file or directory",
  parameters: {
    type: "object",
    properties: {
      path: {
        type: "string",
        description: "Path to delete relative to workspace root",
      },
      recursive: {
        type: "boolean",
        description: "If true, recursively delete directories",
        default: false,
      },
    },
    required: ["path"],
  },
};

export const globSearchTool: ToolDefinition = {
  name: "glob_search",
  description: "Search for files matching a glob pattern",
  parameters: {
    type: "object",
    properties: {
      pattern: {
        type: "string",
        description: "Glob pattern (e.g., '**/*.ts', 'src/**/*.{ts,tsx}')",
      },
    },
    required: ["pattern"],
  },
};

export const applyPatchTool: ToolDefinition = {
  name: "apply_patch",
  description: "Apply targeted changes to an existing file. This is more efficient than rewriting the entire file. You can replace specific line ranges or find/replace text patterns.",
  parameters: {
    type: "object",
    properties: {
      path: {
        type: "string",
        description: "Path to the file to modify",
      },
      changes: {
        type: "array",
        description: "Array of changes to apply",
        items: {
          type: "object",
          properties: {
            startLine: {
              type: "number",
              description: "Starting line number (1-indexed) for line-based replacement",
            },
            endLine: {
              type: "number",
              description: "Ending line number (1-indexed, inclusive) for line-based replacement",
            },
            newContent: {
              type: "string",
              description: "New content to replace the specified lines with",
            },
            find: {
              type: "string",
              description: "Text pattern to find (alternative to line numbers)",
            },
            replace: {
              type: "string",
              description: "Text to replace the found pattern with",
            },
            replaceAll: {
              type: "boolean",
              description: "Replace all occurrences (default: false, only first match)",
              default: false,
            },
          },
        },
      },
    },
    required: ["path", "changes"],
  },
};

export const findInFilesTool: ToolDefinition = {
  name: "find_in_files",
  description: "Search for text patterns in files (like grep). Returns matches with file paths, line numbers, and context.",
  parameters: {
    type: "object",
    properties: {
      pattern: {
        type: "string",
        description: "Text or regex pattern to search for",
      },
      path: {
        type: "string",
        description: "Directory or file to search in (default: workspace root)",
        default: ".",
      },
      includePattern: {
        type: "string",
        description: "Glob pattern for files to include (e.g., '*.ts')",
      },
      excludePattern: {
        type: "string",
        description: "Glob pattern for files to exclude (e.g., 'node_modules/**')",
      },
      caseSensitive: {
        type: "boolean",
        description: "Case sensitive search (default: true)",
        default: true,
      },
      maxResults: {
        type: "number",
        description: "Maximum number of results to return (default: 100)",
        default: 100,
      },
      contextLines: {
        type: "number",
        description: "Number of context lines to show around matches (default: 2)",
        default: 2,
      },
    },
    required: ["pattern"],
  },
};

export const renamePathTool: ToolDefinition = {
  name: "rename_path",
  description: "Rename or move a file or directory",
  parameters: {
    type: "object",
    properties: {
      oldPath: {
        type: "string",
        description: "Current path",
      },
      newPath: {
        type: "string",
        description: "New path",
      },
    },
    required: ["oldPath", "newPath"],
  },
};

export const copyPathTool: ToolDefinition = {
  name: "copy_path",
  description: "Copy a file or directory to a new location",
  parameters: {
    type: "object",
    properties: {
      source: {
        type: "string",
        description: "Source path",
      },
      destination: {
        type: "string",
        description: "Destination path",
      },
      recursive: {
        type: "boolean",
        description: "Recursively copy directories (default: false)",
        default: false,
      },
    },
    required: ["source", "destination"],
  },
};

export const getFileInfoTool: ToolDefinition = {
  name: "get_file_info",
  description: "Get metadata about a file or directory (size, modified time, permissions, etc.)",
  parameters: {
    type: "object",
    properties: {
      path: {
        type: "string",
        description: "Path to the file or directory",
      },
    },
    required: ["path"],
  },
};

export const createDirectoryTool: ToolDefinition = {
  name: "create_directory",
  description: "Create a new directory (creates parent directories if they don't exist)",
  parameters: {
    type: "object",
    properties: {
      path: {
        type: "string",
        description: "Path to the directory to create",
      },
    },
    required: ["path"],
  },
};

export const replaceInFileTool: ToolDefinition = {
  name: "replace_in_file",
  description: "Find and replace text in a file. More convenient than apply_patch for simple text replacements.",
  parameters: {
    type: "object",
    properties: {
      path: {
        type: "string",
        description: "Path to the file",
      },
      find: {
        type: "string",
        description: "Text or regex pattern to find",
      },
      replace: {
        type: "string",
        description: "Text to replace with",
      },
      replaceAll: {
        type: "boolean",
        description: "Replace all occurrences (default: true)",
        default: true,
      },
      regex: {
        type: "boolean",
        description: "Treat find pattern as regex (default: false)",
        default: false,
      },
      caseSensitive: {
        type: "boolean",
        description: "Case sensitive search (default: true)",
        default: true,
      },
    },
    required: ["path", "find", "replace"],
  },
};

export const insertAtLineTool: ToolDefinition = {
  name: "insert_at_line",
  description: "Insert content at a specific line number in a file",
  parameters: {
    type: "object",
    properties: {
      path: {
        type: "string",
        description: "Path to the file",
      },
      line: {
        type: "number",
        description: "Line number to insert at (1-indexed). Use 0 to insert at beginning, -1 for end",
      },
      content: {
        type: "string",
        description: "Content to insert",
      },
    },
    required: ["path", "line", "content"],
  },
};

export const appendToFileTool: ToolDefinition = {
  name: "append_to_file",
  description: "Append content to the end of a file",
  parameters: {
    type: "object",
    properties: {
      path: {
        type: "string",
        description: "Path to the file",
      },
      content: {
        type: "string",
        description: "Content to append",
      },
      newline: {
        type: "boolean",
        description: "Add a newline before appending (default: true)",
        default: true,
      },
    },
    required: ["path", "content"],
  },
};

export const readLinesTool: ToolDefinition = {
  name: "read_lines",
  description: "Read specific line ranges from a file. More efficient than reading the entire file when you only need certain lines.",
  parameters: {
    type: "object",
    properties: {
      path: {
        type: "string",
        description: "Path to the file",
      },
      startLine: {
        type: "number",
        description: "Starting line number (1-indexed)",
      },
      endLine: {
        type: "number",
        description: "Ending line number (1-indexed, inclusive). If not specified, reads to end of file.",
      },
    },
    required: ["path", "startLine"],
  },
};

/**
 * Git tools
 */
export const gitStatusTool: ToolDefinition = {
  name: "git_status",
  description: "Get git status information",
  parameters: {
    type: "object",
    properties: {},
    required: [],
  },
};

export const gitBranchTool: ToolDefinition = {
  name: "git_branch",
  description: "List branches or create/checkout a branch",
  parameters: {
    type: "object",
    properties: {
      action: {
        type: "string",
        enum: ["list", "create", "checkout"],
        description: "Action to perform",
      },
      name: {
        type: "string",
        description: "Branch name (required for create/checkout)",
      },
    },
    required: ["action"],
  },
};

export const gitDiffTool: ToolDefinition = {
  name: "git_diff",
  description: "Get git diff for staged or unstaged changes",
  parameters: {
    type: "object",
    properties: {
      staged: {
        type: "boolean",
        description: "Show staged changes (default: false)",
        default: false,
      },
    },
    required: [],
  },
};

export const gitCommitTool: ToolDefinition = {
  name: "git_commit",
  description: "Create a git commit",
  parameters: {
    type: "object",
    properties: {
      message: {
        type: "string",
        description: "Commit message",
      },
      files: {
        type: "array",
        items: { type: "string" },
        description: "Specific files to commit (default: all staged)",
      },
    },
    required: ["message"],
  },
};

export const gitPushTool: ToolDefinition = {
  name: "git_push",
  description: "Push commits to remote repository",
  parameters: {
    type: "object",
    properties: {
      branch: {
        type: "string",
        description: "Branch to push (default: current branch)",
      },
      remote: {
        type: "string",
        description: "Remote name (default: origin)",
        default: "origin",
      },
    },
    required: [],
  },
};

export const gitCheckoutTool: ToolDefinition = {
  name: "git_checkout",
  description: "Checkout a branch or file",
  parameters: {
    type: "object",
    properties: {
      ref: {
        type: "string",
        description: "Branch name or file path",
      },
    },
    required: ["ref"],
  },
};

export const gitRevertTool: ToolDefinition = {
  name: "git_revert",
  description: "Revert changes to a file or commit",
  parameters: {
    type: "object",
    properties: {
      ref: {
        type: "string",
        description: "Commit hash or file path to revert",
      },
    },
    required: ["ref"],
  },
};

/**
 * Package management tools
 */
export const npmInstallTool: ToolDefinition = {
  name: "npm_install",
  description: "Install npm packages",
  parameters: {
    type: "object",
    properties: {
      packages: {
        type: "array",
        items: { type: "string" },
        description: "Package names to install",
      },
      dev: {
        type: "boolean",
        description: "Install as dev dependencies",
        default: false,
      },
    },
    required: ["packages"],
  },
};

export const npmUninstallTool: ToolDefinition = {
  name: "npm_uninstall",
  description: "Uninstall npm packages",
  parameters: {
    type: "object",
    properties: {
      packages: {
        type: "array",
        items: { type: "string" },
        description: "Package names to uninstall",
      },
    },
    required: ["packages"],
  },
};

/**
 * Database tools (Supabase)
 */
export const dbQueryTool: ToolDefinition = {
  name: "db_query",
  description: "Execute a SELECT query against Supabase database",
  parameters: {
    type: "object",
    properties: {
      table: {
        type: "string",
        description: "Table name",
      },
      select: {
        type: "string",
        description: "Columns to select (default: *)",
        default: "*",
      },
      filters: {
        type: "object",
        description: "Filter conditions (key-value pairs for filtering rows)",
      },
      limit: {
        type: "number",
        description: "Maximum number of rows to return",
      },
    },
    required: ["table"],
  },
};

export const dbInsertTool: ToolDefinition = {
  name: "db_insert",
  description: "Insert rows into a Supabase table",
  parameters: {
    type: "object",
    properties: {
      table: {
        type: "string",
        description: "Table name",
      },
      values: {
        type: "array",
        description: "Array of objects to insert",
        items: { type: "object" },
      },
    },
    required: ["table", "values"],
  },
};

export const dbUpdateTool: ToolDefinition = {
  name: "db_update",
  description: "Update rows in a Supabase table",
  parameters: {
    type: "object",
    properties: {
      table: {
        type: "string",
        description: "Table name",
      },
      values: {
        type: "object",
        description: "Values to update",
      },
      filters: {
        type: "object",
        description: "Filter conditions (key-value pairs for filtering rows)",
      },
    },
    required: ["table", "values", "filters"],
  },
};

export const dbDeleteTool: ToolDefinition = {
  name: "db_delete",
  description: "Delete rows from a Supabase table",
  parameters: {
    type: "object",
    properties: {
      table: {
        type: "string",
        description: "Table name",
      },
      filters: {
        type: "object",
        description: "Filter conditions (key-value pairs for filtering rows)",
      },
    },
    required: ["table", "filters"],
  },
};

/**
 * Sandbox tools
 */
export const sandboxInfoTool: ToolDefinition = {
  name: "sandbox_info",
  description: "Get information about the sandbox",
  parameters: {
    type: "object",
    properties: {},
    required: [],
  },
};

export const portListTool: ToolDefinition = {
  name: "port_list",
  description: "List open ports in the sandbox",
  parameters: {
    type: "object",
    properties: {},
    required: [],
  },
};

export const openPortTool: ToolDefinition = {
  name: "open_port",
  description: "Open a port for access",
  parameters: {
    type: "object",
    properties: {
      port: {
        type: "number",
        description: "Port number",
      },
      protocol: {
        type: "string",
        enum: ["http", "https"],
        description: "Protocol (default: http)",
        default: "http",
      },
    },
    required: ["port"],
  },
};

export const getConsoleLogsTool: ToolDefinition = {
  name: "get_console_logs",
  description: "Get console logs and errors from the sandbox. Use this to check for errors, warnings, or other log messages after making code changes. This helps detect compilation errors, runtime errors, dependency issues, and other problems before finishing the response.",
  parameters: {
    type: "object",
    properties: {
      limit: {
        type: "number",
        description: "Maximum number of log entries to return (default: 50)",
        default: 50,
      },
      level: {
        type: "string",
        enum: ["all", "error", "warn", "info"],
        description: "Filter by log level: 'all' returns all logs, 'error' returns only errors, 'warn' returns warnings and errors, 'info' returns info, warn, and error logs (default: 'all')",
        default: "all",
      },
      since: {
        type: "number",
        description: "Only return logs since this timestamp in milliseconds (Unix timestamp). Useful for getting logs after a specific time.",
      },
    },
    required: [],
  },
};

export const checkTypeErrorsTool: ToolDefinition = {
  name: "check_type_errors",
  description: "Run TypeScript type checking to detect type errors in the codebase. This checks for TypeScript compilation errors without emitting files. Use this to verify that all code is type-safe before finishing.",
  parameters: {
    type: "object",
    properties: {
      includeWarnings: {
        type: "boolean",
        description: "Include warnings in addition to errors (default: false)",
        default: false,
      },
    },
    required: [],
  },
};

/**
 * Metadata tools
 */
export const projectInfoTool: ToolDefinition = {
  name: "project_info",
  description: "Get project metadata and configuration",
  parameters: {
    type: "object",
    properties: {},
    required: [],
  },
};

export const envReadTool: ToolDefinition = {
  name: "env_read",
  description: "Read environment variables",
  parameters: {
    type: "object",
    properties: {
      keys: {
        type: "array",
        items: { type: "string" },
        description: "Specific keys to read (default: all)",
      },
    },
    required: [],
  },
};

export const envWriteTool: ToolDefinition = {
  name: "env_write",
  description: "Write environment variables",
  parameters: {
    type: "object",
    properties: {
      variables: {
        type: "object",
        description: "Environment variables to set",
        additionalProperties: { type: "string" },
      },
    },
    required: ["variables"],
  },
};

/**
 * View MDAP plan artifacts
 * Lists all plan artifacts in the plans directory
 */
export const viewPlansTool: ToolDefinition = {
  name: "view_plans",
  description: "View all MDAP execution plan artifacts. Lists all plan files in the plans directory. Use this to see what plans have been created and their details. You can then use read_file to read a specific plan.",
  parameters: {
    type: "object",
    properties: {
      limit: {
        type: "number",
        description: "Maximum number of plans to return (default: 10)",
        default: 10,
      },
    },
    required: [],
  },
};

/**
 * Delete an artifact (including plans)
 * Deletes an artifact by its path or ID
 */
export const deleteArtifactTool: ToolDefinition = {
  name: "delete_artifact",
  description: "Delete an artifact (including plan artifacts) by its path. Use this to remove plans or other artifacts that are no longer needed.",
  parameters: {
    type: "object",
    properties: {
      path: {
        type: "string",
        description: "Path to the artifact file relative to workspace root (e.g., 'plans/plan-name.md')",
      },
    },
    required: ["path"],
  },
};

/**
 * Registry of all tools
 */
export const toolRegistry: ToolDefinition[] = [
  // Filesystem
  readFileTool,
  readLinesTool,
  writeFileTool,
  appendToFileTool,
  insertAtLineTool,
  applyPatchTool,
  replaceInFileTool,
  listDirectoryTool,
  createDirectoryTool,
  deletePathTool,
  renamePathTool,
  copyPathTool,
  getFileInfoTool,
  globSearchTool,
  findInFilesTool,
  searchProjectTool,
  // Git
  gitStatusTool,
  gitBranchTool,
  gitDiffTool,
  gitCommitTool,
  gitPushTool,
  gitCheckoutTool,
  gitRevertTool,
  // Packages
  npmInstallTool,
  npmUninstallTool,
  // Sandbox
  sandboxInfoTool,
  portListTool,
  openPortTool,
  getConsoleLogsTool,
  checkTypeErrorsTool,
  // Metadata
  projectInfoTool,
  envReadTool,
  envWriteTool,
  // Artifacts
  viewPlansTool,
  deleteArtifactTool,
];

