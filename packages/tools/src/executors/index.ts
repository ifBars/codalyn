/**
 * Executor registry - centralizes all tool executors
 */

// Filesystem executors
import { readFileExecutor } from "./filesystem/read_file";
import { readLinesExecutor } from "./filesystem/read_lines";
import { writeFileExecutor } from "./filesystem/write_file";
import { appendToFileExecutor } from "./filesystem/append_to_file";
import { insertAtLineExecutor } from "./filesystem/insert_at_line";
import { applyPatchExecutor } from "./filesystem/apply_patch";
import { replaceInFileExecutor } from "./filesystem/replace_in_file";
import { listDirectoryExecutor } from "./filesystem/list_directory";
import { createDirectoryExecutor } from "./filesystem/create_directory";
import { renamePathExecutor } from "./filesystem/rename_path";
import { copyPathExecutor } from "./filesystem/copy_path";
import { getFileInfoExecutor } from "./filesystem/get_file_info";
import { findInFilesExecutor } from "./filesystem/find_in_files";
import { globSearchExecutor } from "./filesystem/glob_search";
import { deletePathExecutor } from "./filesystem/delete_path";

// Package management executors
import { bunRunExecutor } from "./package-management/bun_run";
import { npmInstallExecutor } from "./package-management/npm_install";
import { npmUninstallExecutor } from "./package-management/npm_uninstall";

// Search executors
import { searchProjectExecutor } from "./search/search_project";

// Git executors
import { gitStatusExecutor } from "./git/git_status";
import { gitBranchExecutor } from "./git/git_branch";
import { gitDiffExecutor } from "./git/git_diff";
import { gitCommitExecutor } from "./git/git_commit";
import { gitPushExecutor } from "./git/git_push";
import { gitCheckoutExecutor } from "./git/git_checkout";
import { gitRevertExecutor } from "./git/git_revert";

// Metadata executors
import { envReadExecutor } from "./metadata/env_read";
import { envWriteExecutor } from "./metadata/env_write";
import { projectInfoExecutor } from "./metadata/project_info";

// Sandbox executors
import { sandboxInfoExecutor } from "./sandbox/sandbox_info";
import { portListExecutor } from "./sandbox/port_list";
import { openPortExecutor } from "./sandbox/open_port";

// Re-export types
export * from "./types";
import type { ToolExecutor } from "./types";

// Executor registry
export const executorRegistry: Map<string, ToolExecutor> = new Map([
  // Filesystem
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
  ["glob_search", globSearchExecutor],
  ["delete_path", deletePathExecutor],
  // Package management
  ["bun_run", bunRunExecutor],
  ["npm_install", npmInstallExecutor],
  ["npm_uninstall", npmUninstallExecutor],
  // Search
  ["search_project", searchProjectExecutor],
  // Git
  ["git_status", gitStatusExecutor],
  ["git_branch", gitBranchExecutor],
  ["git_diff", gitDiffExecutor],
  ["git_commit", gitCommitExecutor],
  ["git_push", gitPushExecutor],
  ["git_checkout", gitCheckoutExecutor],
  ["git_revert", gitRevertExecutor],
  // Metadata
  ["env_read", envReadExecutor],
  ["env_write", envWriteExecutor],
  ["project_info", projectInfoExecutor],
  // Sandbox
  ["sandbox_info", sandboxInfoExecutor],
  ["port_list", portListExecutor],
  ["open_port", openPortExecutor],
]);

export function getExecutor(toolName: string): ToolExecutor | undefined {
  return executorRegistry.get(toolName);
}

