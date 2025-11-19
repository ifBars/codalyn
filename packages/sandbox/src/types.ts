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
}

export interface SandboxPort {
  port: number;
  protocol: "http" | "https";
  onPortForward?: (url: string) => void;
}

export interface SandboxOptions {
  files?: Record<string, string>;
  environment?: Record<string, string>;
}

export interface SandboxInterface {
  // File system operations
  readFile(path: string): Promise<string>;
  writeFile(path: string, content: string): Promise<void>;
  readdir(path: string): Promise<string[]>;
  deletePath(path: string, options?: { recursive?: boolean }): Promise<void>;
  mkdir(path: string, options?: { recursive?: boolean }): Promise<void>;
  glob(pattern: string): Promise<string[]>;

  // Command execution
  runCommand(
    command: string,
    options?: {
      cwd?: string;
      env?: Record<string, string>;
      timeout?: number;
      background?: boolean;
    }
  ): Promise<SandboxProcess>;

  // Port management
  getPorts(): Promise<SandboxPort[]>;
  openPort(port: number, protocol?: "http" | "https"): Promise<void>;

  // Lifecycle
  init(options?: SandboxOptions): Promise<void>;
  destroy(): Promise<void>;

  // Info
  getInfo(): Promise<{ type: "webcontainer" | "docker"; ready: boolean }>;
}

