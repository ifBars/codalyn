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

/**
 * Command execution tools
 */
export const runCommandTool: ToolDefinition = {
  name: "run_command",
  description: "Execute a shell command in the workspace",
  parameters: {
    type: "object",
    properties: {
      command: {
        type: "string",
        description: "Shell command to execute",
      },
      cwd: {
        type: "string",
        description: "Working directory (default: workspace root)",
      },
      env: {
        type: "object",
        description: "Environment variables to set",
        additionalProperties: { type: "string" },
      },
      timeout: {
        type: "number",
        description: "Timeout in milliseconds (default: 30000)",
      },
      background: {
        type: "boolean",
        description: "Run in background (default: false)",
        default: false,
      },
    },
    required: ["command"],
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
        description: "Filter conditions",
        additionalProperties: { type: "any" },
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
        description: "Filter conditions",
        additionalProperties: { type: "any" },
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
        description: "Filter conditions",
        additionalProperties: { type: "any" },
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
 * Registry of all tools
 */
export const toolRegistry: ToolDefinition[] = [
  // Filesystem
  readFileTool,
  writeFileTool,
  listDirectoryTool,
  deletePathTool,
  globSearchTool,
  searchProjectTool,
  // Commands
  runCommandTool,
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
  // Database
  dbQueryTool,
  dbInsertTool,
  dbUpdateTool,
  dbDeleteTool,
  // Sandbox
  sandboxInfoTool,
  portListTool,
  openPortTool,
  // Metadata
  projectInfoTool,
  envReadTool,
  envWriteTool,
];

