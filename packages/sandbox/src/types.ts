/**
 * Sandbox interface types
 */

export interface SandboxFileSystem {
  readFile(path: string): Promise<string>;
  writeFile(path: string, content: string): Promise<void>;
  readdir(path: string): Promise<string[]>;
  rm(path: string, options?: { recursive?: boolean }): Promise<void>;
  mkdir(path: string, options?: { recursive?: boolean }): Promise<void>;
}

export interface SandboxProcess {
  id: string;
  kill(): Promise<void>;
  output: ReadableStream<string>;
  resize?(dimensions: { cols: number; rows: number }): void;
  exit?: Promise<number>;
}

export interface SandboxPort {
  port: number;
  protocol: "http" | "https";
  url?: string;
  onPortForward?: (url: string) => void;
}

export interface FileWatcher {
  close(): void;
}

export type FileSystemEvent = 'rename' | 'change';
export type FileSystemListener = (event: FileSystemEvent, filename: string | Buffer) => void;

export interface SandboxOptions {
  files?: Record<string, string>;
  environment?: Record<string, string>;
}

export interface LogEntry {
  timestamp: number;
  level: 'error' | 'warn' | 'info' | 'log';
  message: string;
  source?: string; // e.g., 'vite', 'dev-server', 'build'
}

export type ErrorCallback = (error: string) => void;

export interface DevServerOptions {
  command?: string;
  args?: string[];
  timeout?: number;
  onOutput?: (text: string) => void;
}

export interface InitProjectOptions {
  files?: import("@webcontainer/api").FileSystemTree;
  installDeps?: boolean;
  startDevServer?: boolean;
  devServerOptions?: DevServerOptions;
  mountPoint?: string; // Directory to mount files into (defaults to root)
}

export interface SpawnOptions {
  cwd?: string;
  env?: Record<string, string | number | boolean>;
  output?: boolean; // When false, no terminal output is sent back
  terminal?: { cols: number; rows: number }; // Terminal size
}

export interface WebContainerEventListeners {
  onPort?: (port: number, type: "open" | "close", url: string) => void;
  onError?: (error: { message: string }) => void;
  onServerReady?: (port: number, url: string) => void;
  onPreviewMessage?: (message: PreviewMessage) => void;
}

export interface PreviewMessage {
  previewId: string;
  port: number;
  pathname: string;
  search: string;
  hash: string;
  type: 'uncaught-exception' | 'unhandled-rejection' | 'console-error';
  message?: string;
  stack?: string;
  args?: any[];
}

export interface SandboxInterface {
  // File system operations
  readFile(path: string): Promise<string>;
  writeFile(path: string, content: string): Promise<void>;
  readdir(path: string): Promise<string[]>;
  deletePath(path: string, options?: { recursive?: boolean }): Promise<void>;
  mkdir(path: string, options?: { recursive?: boolean }): Promise<void>;
  glob(pattern: string): Promise<string[]>;
  watch?(path: string, options?: { recursive?: boolean }, listener?: FileSystemListener): FileWatcher;

  // Command execution
  runCommand(
    command: string,
    options?: {
      cwd?: string;
      env?: Record<string, string>;
      timeout?: number;
      background?: boolean;
      output?: boolean;
      terminal?: { cols: number; rows: number };
    }
  ): Promise<SandboxProcess>;

  // Package management
  installPackage?(packages: string[], options?: { dev?: boolean }): Promise<{ success: boolean; output?: string; error?: string }>;

  // Port management
  getPorts(): Promise<SandboxPort[]>;
  openPort(port: number, protocol?: "http" | "https"): Promise<void>;

  // Lifecycle
  init(options?: SandboxOptions): Promise<void>;
  destroy(): Promise<void>;

  // Info
  getInfo(): Promise<{ type: "webcontainer" | "docker"; ready: boolean }>;

  // Console logs
  getConsoleLogs(options?: {
    limit?: number;
    level?: 'all' | 'error' | 'warn' | 'info';
    since?: number;
  }): Promise<LogEntry[]>;
}

