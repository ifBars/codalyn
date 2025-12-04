import { 
  SandboxInterface, 
  SandboxOptions, 
  SandboxProcess, 
  SandboxPort, 
  LogEntry,
  ErrorCallback,
  DevServerOptions,
  InitProjectOptions,
  FileWatcher,
  FileSystemListener,
  FileSystemEvent,
  WebContainerEventListeners,
  PreviewMessage
} from "./types";
import { WebContainer, type FileSystemTree } from "@webcontainer/api";

/**
 * WebContainer sandbox implementation
 * Uses singleton WebContainer instance to avoid multiple boots
 */
export class WebContainerSandbox implements SandboxInterface {
  private webcontainer: WebContainer | null = null;
  private ports: Map<number, SandboxPort> = new Map();
  private consoleLogs: LogEntry[] = [];
  private readonly MAX_LOG_ENTRIES = 1000;
  private devProcess: any | null = null;
  private serverUrl: string | null = null;
  private errorCallbacks: Set<ErrorCallback> = new Set();
  private eventUnsubscribers: Array<() => void> = [];
  private watchers: Set<FileWatcher> = new Set();

  /**
   * Get the singleton WebContainer instance
   * Uses WebContainerManager to ensure only one instance is booted
   * Uses lazy import to avoid circular dependency
   * Always gets fresh reference from manager to avoid stale proxy errors
   */
  private async getWebContainer(): Promise<WebContainer> {
    // Always get fresh reference from manager to avoid stale proxy errors
    // The manager ensures only one instance exists, so this is safe
    const { WebContainerManager } = await import("./webcontainer-manager");
    const container = await WebContainerManager.getInstance();
    
    // Cache for convenience, but always refresh from manager
    this.webcontainer = container;
    return container;
  }

  /**
   * Set up event listeners for WebContainer events
   */
  private setupEventListeners(container: WebContainer, listeners?: WebContainerEventListeners): void {
    // Clear existing listeners
    this.eventUnsubscribers.forEach(unsub => unsub());
    this.eventUnsubscribers = [];

    // Port events
    if (listeners?.onPort) {
      const unsub = container.on("port", (port, type, url) => {
        if (type === "open") {
          this.ports.set(port, { port, protocol: url.startsWith("https") ? "https" : "http", url });
        } else {
          this.ports.delete(port);
        }
        listeners.onPort!(port, type, url);
      });
      this.eventUnsubscribers.push(unsub);
    }

    // Error events
    if (listeners?.onError) {
      const unsub = container.on("error", (error) => {
        this.addLog('error', error.message, 'webcontainer');
        this.triggerErrorCallbacks(error.message);
        listeners.onError!(error);
      });
      this.eventUnsubscribers.push(unsub);
    }

    // Server ready events (handled separately in startDevServer, but can be set up here too)
    if (listeners?.onServerReady) {
      const unsub = container.on("server-ready", (port, url) => {
        this.serverUrl = url;
        this.ports.set(port, { port, protocol: url.startsWith("https") ? "https" : "http", url });
        listeners.onServerReady!(port, url);
      });
      this.eventUnsubscribers.push(unsub);
    }

    // Preview message events (for error detection)
    if (listeners?.onPreviewMessage) {
      const unsub = container.on("preview-message", (message: any) => {
        const previewMsg: PreviewMessage = {
          previewId: message.previewId,
          port: message.port,
          pathname: message.pathname,
          search: message.search,
          hash: message.hash,
          type: message.type === 'UncaughtException' ? 'uncaught-exception' :
                message.type === 'UnhandledRejection' ? 'unhandled-rejection' : 'console-error',
          message: message.message,
          stack: message.stack,
          args: message.args,
        };
        
        if (previewMsg.type === 'uncaught-exception' || previewMsg.type === 'unhandled-rejection') {
          const errorMsg = `${previewMsg.type}: ${previewMsg.message}\n${previewMsg.stack || ''}`;
          this.addLog('error', errorMsg, 'preview');
          this.triggerErrorCallbacks(errorMsg);
        }
        
        listeners.onPreviewMessage!(previewMsg);
      });
      this.eventUnsubscribers.push(unsub);
    }
  }

  /**
   * Set event listeners for WebContainer events
   */
  setEventListeners(listeners: WebContainerEventListeners): void {
    if (this.webcontainer) {
      this.setupEventListeners(this.webcontainer, listeners);
    } else {
      // Will be set up when container is initialized
      this.getWebContainer().then(container => {
        this.setupEventListeners(container, listeners);
      });
    }
  }

  async init(options?: SandboxOptions | InitProjectOptions): Promise<void> {
    // Get the singleton WebContainer instance
    const container = await this.getWebContainer();

    // Set up default event listeners if not already set up
    if (this.eventUnsubscribers.length === 0) {
      this.setupEventListeners(container, {
        onError: (error) => {
          console.error("[WebContainer] Error:", error.message);
        },
        onPort: (port, type, url) => {
          console.log(`[WebContainer] Port ${type}: ${port} at ${url}`);
        },
      });
    }

    // Handle InitProjectOptions with FileSystemTree
    if (options && 'files' in options && options.files && typeof options.files === 'object' && !('toString' in options.files)) {
      const initOptions = options as InitProjectOptions;
      const fileTree = initOptions.files as FileSystemTree;
      
      // Mount files if provided
      if (fileTree) {
        await container.mount(fileTree, initOptions.mountPoint ? { mountPoint: initOptions.mountPoint } : undefined);
      }

      // Install dependencies if requested
      if (initOptions.installDeps !== false) {
        try {
          const packageJsonContent = await this.readFile("package.json").catch(() => null);
          if (packageJsonContent) {
            const packageJson = JSON.parse(packageJsonContent);
            const depCount = Object.keys(packageJson.dependencies || {}).length;
            const devDepCount = Object.keys(packageJson.devDependencies || {}).length;
            
            if (depCount > 0 || devDepCount > 0) {
              console.log(`[init] Installing ${depCount} dependencies and ${devDepCount} devDependencies...`);
              const installProcess = await container.spawn("npm", ["install"]);
              const exitCode = await installProcess.exit;
              if (exitCode !== 0) {
                console.warn(`[init] npm install exited with code ${exitCode}`);
              } else {
                console.log(`[init] Dependencies installed successfully`);
              }
            }
          }
        } catch (error) {
          console.warn(`[init] Failed to install dependencies:`, error);
        }
      }

      // Start dev server if requested
      if (initOptions.startDevServer) {
        await this.startDevServer(initOptions.devServerOptions);
      }
    }
  }

  async readFile(path: string): Promise<string> {
    try {
      const container = await this.getWebContainer();
      const file = await container.fs.readFile(path, "utf-8");
      return file as string;
    } catch (error: any) {
      // Handle proxy released errors by clearing cache and retrying once
      if (error?.message?.includes("Proxy has been released") || error?.message?.includes("released")) {
        this.webcontainer = null;
        const container = await this.getWebContainer();
        return await container.fs.readFile(path, "utf-8") as string;
      }
      throw error;
    }
  }

  async writeFile(path: string, content: string): Promise<void> {
    const container = await this.getWebContainer();
    
    // Normalize path - ensure consistent forward slashes
    // Remove leading slash if present (WebContainer uses relative paths from root)
    const normalizedPath = path.replace(/^\/+/, '').replace(/\/+/g, '/');
    
    // Extract directory path and create it if needed
    const dirPath = normalizedPath.split('/').slice(0, -1).join('/');
    if (dirPath) {
      // Create parent directories recursively
      try {
        await container.fs.mkdir(dirPath, { recursive: true });
      } catch {
        // If recursive fails, try creating directories one by one as fallback
          const parts = dirPath.split('/').filter(Boolean);
          let currentPath = '';
          for (const part of parts) {
            currentPath = currentPath ? `${currentPath}/${part}` : part;
            try {
              await container.fs.mkdir(currentPath);
          } catch (dirError: any) {
            // Only ignore "directory already exists" errors
            const isExistsError = 
              dirError?.code === 'EEXIST' || 
              dirError?.message?.includes('already exists') ||
              dirError?.message?.includes('EEXIST');
            
            if (!isExistsError) {
              throw dirError;
            }
          }
        }
      }
    }
    
    // Write the file
    await container.fs.writeFile(normalizedPath, content);
  }

  async readdir(path: string): Promise<string[]> {
    const container = await this.getWebContainer();
    const entries = await container.fs.readdir(path, { withFileTypes: true });
    return entries.map((e) => e.name);
  }

  async deletePath(path: string, options?: { recursive?: boolean }): Promise<void> {
    const container = await this.getWebContainer();

    // Normalize to a workspace-relative path (WebContainers expect relative paths)
    let normalizedPath = path.replace(/\\/g, "/").replace(/^\/+/, "").replace(/\/+/g, "/");
    if (normalizedPath.startsWith("home/")) {
      const srcIndex = normalizedPath.indexOf("src/");
      if (srcIndex >= 0) {
        normalizedPath = normalizedPath.substring(srcIndex);
      } else {
        // Drop the leading home/<random>/ prefix and use the last path segments
        const parts = normalizedPath.split("/").filter(Boolean);
        if (parts.length > 1) {
          normalizedPath = parts.slice(parts.length - 2).join("/");
        }
      }
    }

    const fsAny = container.fs as any;
    if (fsAny?.stat) {
      try {
        await fsAny.stat(normalizedPath);
      } catch (err: any) {
        const code = err?.code || err?.message || "ENOENT";
        throw new Error(`Path not found: ${path} (resolved to ${normalizedPath}) [${code}]`);
      }
    }

    await container.fs.rm(normalizedPath, { recursive: options?.recursive ?? false });
  }

  async mkdir(path: string, options?: { recursive?: boolean }): Promise<void> {
    const container = await this.getWebContainer();
    if (options?.recursive) {
      await container.fs.mkdir(path, { recursive: true });
    } else {
      await container.fs.mkdir(path);
    }
  }

  async glob(pattern: string): Promise<string[]> {
    // Simple glob implementation - can be enhanced later
    const allFiles: string[] = [];
    const walk = async (dir: string) => {
      const entries = await this.readdir(dir);
      for (const entry of entries) {
        const fullPath = `${dir}/${entry}`;
        try {
          await this.readFile(fullPath);
          allFiles.push(fullPath);
        } catch {
          // Directory, recurse
          await walk(fullPath);
        }
      }
    };
    await walk(".");
    // Simple pattern matching - enhance with proper glob library if needed
    return allFiles.filter((f) => {
      if (pattern.includes("*")) {
        const regex = new RegExp(pattern.replace(/\*/g, ".*"));
        return regex.test(f);
      }
      return f.includes(pattern);
    });
  }

  async runCommand(
    command: string,
    options?: {
      cwd?: string;
      env?: Record<string, string>;
      timeout?: number;
      background?: boolean;
      output?: boolean;
      terminal?: { cols: number; rows: number };
    }
  ): Promise<SandboxProcess> {
    const container = await this.getWebContainer();
    
    // Convert env to WebContainer format (string | number | boolean)
    const env = options?.env ? Object.fromEntries(
      Object.entries(options.env).map(([k, v]) => [k, typeof v === 'string' ? v : String(v)])
    ) : undefined;

    const spawnOptions: any = {
      cwd: options?.cwd,
      env,
      output: options?.output !== false, // Default to true
    };

    if (options?.terminal) {
      spawnOptions.terminal = options.terminal;
    }

    const process = await container.spawn("sh", ["-c", command], spawnOptions);

    // Generate a unique ID since WebContainer processes don't expose pid
    const processId = crypto.randomUUID();

    // Note: Log capture from process output is handled by WebContainerManager
    // for the dev server. For other commands, logs can be captured by reading
    // the output stream returned in SandboxProcess.

    return {
      id: processId,
      kill: async () => {
        process.kill();
      },
      output: process.output,
      resize: options?.terminal ? (dimensions: { cols: number; rows: number }) => {
        process.resize(dimensions);
      } : undefined,
      exit: process.exit,
    };
  }

  async getPorts(): Promise<SandboxPort[]> {
    return Array.from(this.ports.values());
  }

  async openPort(port: number, protocol: "http" | "https" = "http"): Promise<void> {
    // Ports are automatically tracked via 'port' events
    // This method is kept for API compatibility
    if (!this.ports.has(port)) {
      this.ports.set(port, { port, protocol });
    }
  }

  watch(path: string, options?: { recursive?: boolean }, listener?: FileSystemListener): FileWatcher {
    const container = this.webcontainer;
    if (!container) {
      throw new Error("Sandbox not initialized. Call init() first.");
    }

    // Adapter to convert WebContainer's Uint8Array to Buffer for FileSystemListener
    const adaptedListener = listener 
      ? (event: string, filename: string | Uint8Array) => {
          // Convert Uint8Array to Buffer if needed
          const filenameBuffer = filename instanceof Uint8Array 
            ? Buffer.from(filename) 
            : filename;
          listener(event as FileSystemEvent, filenameBuffer);
        }
      : undefined;

    const watcher = container.fs.watch(path, options || {}, adaptedListener || (() => {}));
    this.watchers.add(watcher);

    return {
      close: () => {
        watcher.close();
        this.watchers.delete(watcher);
      },
    };
  }

  async getInfo(): Promise<{ type: "webcontainer" | "docker"; ready: boolean }> {
    try {
      await this.getWebContainer();
      return {
        type: "webcontainer",
        ready: true,
      };
    } catch {
      return {
        type: "webcontainer",
        ready: false,
      };
    }
  }

  async getConsoleLogs(options?: {
    limit?: number;
    level?: 'all' | 'error' | 'warn' | 'info';
    since?: number;
  }): Promise<LogEntry[]> {
    let logs = [...this.consoleLogs];

    // Filter by timestamp if provided
    if (options?.since) {
      logs = logs.filter(log => log.timestamp >= options.since!);
    }

    // Filter by level if provided
    if (options?.level && options.level !== 'all') {
      logs = logs.filter(log => log.level === options.level);
    }

    // Sort by timestamp (newest first)
    logs.sort((a, b) => b.timestamp - a.timestamp);

    // Apply limit
    const limit = options?.limit ?? 50;
    return logs.slice(0, limit);
  }

  /**
   * Start a dev server (e.g., Vite, Next.js)
   * @param options Options for starting the dev server
   * @returns Promise resolving to the server URL
   */
  async startDevServer(options?: DevServerOptions): Promise<string> {
    const container = await this.getWebContainer();

    // Kill any existing dev process
    if (this.devProcess) {
      try {
        this.devProcess.kill();
        await new Promise(resolve => setTimeout(resolve, 500));
      } catch (error) {
        console.warn(`[startDevServer] Error killing existing dev process:`, error);
      }
      this.devProcess = null;
      this.serverUrl = null;
    }

    const command = options?.command || "npm";
    const args = options?.args || ["run", "dev"];
    const timeout = options?.timeout || 30000;

    console.log(`[startDevServer] Starting dev server: ${command} ${args.join(' ')}`);

    // Start dev server
    const devProcess = await container.spawn(command, args);
    this.devProcess = devProcess;

    // Capture output to detect when server is ready
    const outputChunks: string[] = [];
    let serverUrl: string | null = null;
    let serverReady = false;

    // Set up server-ready event listener (WebContainer API)
    const serverReadyListener = (port: number, url: string) => {
      console.log(`[server] Server ready event on port ${port} at ${url}`);
      serverUrl = url;
      serverReady = true;
    };
    const unsubscribeServerReady = container.on("server-ready", serverReadyListener);

    // Parse output to detect server startup
    devProcess.output.pipeTo(
      new WritableStream({
        write: (data) => {
          // Convert data to string
          const text = typeof data === 'string'
            ? data
            : (data as any) instanceof Uint8Array
              ? new TextDecoder().decode(data)
              : String(data);

          outputChunks.push(text);
          
          // Call custom output handler if provided
          if (options?.onOutput) {
            options.onOutput(text);
          }

          // Store log entry
          const logSource = 'dev-server';

          // Check for server ready messages (Vite format)
          const viteUrlMatch = text.match(/Local:\s*(https?:\/\/[^\s]+)/i) ||
            text.match(/➜\s*Local:\s*(https?:\/\/[^\s]+)/i) ||
            text.match(/ready in \d+ms/i);

          if (viteUrlMatch && !serverReady) {
            const detectedUrl = viteUrlMatch[1] || `http://localhost:5173`;
            console.log(`[server] Detected server ready at ${detectedUrl}`);
            serverUrl = detectedUrl;
            serverReady = true;
            this.addLog('info', `Server ready at ${detectedUrl}`, logSource);
          }

          // Check for errors
          if (text.includes('error') || text.match(/\[error\]/i)) {
            this.addLog('error', text.substring(0, 1000), logSource);
            
            // Trigger error callbacks
            if (text.includes('Internal server error') || 
                text.match(/500\s+Internal\s+Server\s+Error/i)) {
              this.triggerErrorCallbacks(text);
            }
          } else if (text.toLowerCase().includes('warning') || text.match(/\[warn\]/i)) {
            this.addLog('warn', text.substring(0, 1000), logSource);
          } else {
            this.addLog('info', text.substring(0, 1000), logSource);
          }
        },
      })
    ).catch((err) => {
      console.error("[startDevServer] Output stream error:", err);
    });

    // Wait for server to be ready
    const waitForServer = (): Promise<string> => {
      return new Promise((resolve, reject) => {
        const timeoutHandle = setTimeout(() => {
          cleanup();
          const allOutput = outputChunks.join('');
          const viteUrlMatch = allOutput.match(/Local:\s*(https?:\/\/[^\s]+)/i) ||
            allOutput.match(/➜\s*Local:\s*(https?:\/\/[^\s]+)/i);

          if (viteUrlMatch) {
            const url = viteUrlMatch[1] || `http://localhost:5173`;
            resolve(url);
            return;
          }

          // Check if process is still running
          Promise.race([
            devProcess.exit,
            new Promise<number>((resolve) => setTimeout(() => resolve(-999), 100))
          ]).then((exitCode) => {
            if (exitCode === -999 || exitCode === 0) {
              resolve(`http://localhost:5173`);
            } else {
              reject(new Error(`Dev server exited with code ${exitCode}. Output: ${allOutput.slice(-2000)}`));
            }
          }).catch(() => {
            resolve(`http://localhost:5173`);
          });
        }, timeout);

        const checkInterval = setInterval(() => {
          if (serverReady && serverUrl) {
            cleanup();
            resolve(serverUrl);
          }
        }, 100);

        function cleanup() {
          clearInterval(checkInterval);
          clearTimeout(timeoutHandle);
          if (unsubscribeServerReady) {
            unsubscribeServerReady();
          }
        }

        // Check for process exit errors
        devProcess.exit.then((exitCode) => {
          if (exitCode !== null && exitCode !== 0) {
            cleanup();
            const allOutput = outputChunks.join('');
            reject(new Error(`Dev server exited with code ${exitCode}. Output: ${allOutput.slice(-2000)}`));
          }
        }).catch(() => {
          // Process still running, continue waiting
        });
      });
    };

    try {
      const url = await waitForServer();
      this.serverUrl = url;
      console.log(`[startDevServer] Server confirmed ready at ${url}`);
      return url;
    } catch (error: any) {
      const allOutput = outputChunks.join('');
      const viteUrlMatch = allOutput.match(/Local:\s*(https?:\/\/[^\s]+)/i) ||
        allOutput.match(/➜\s*Local:\s*(https?:\/\/[^\s]+)/i);

      if (viteUrlMatch) {
        const url = viteUrlMatch[1] || `http://localhost:5173`;
        this.serverUrl = url;
        return url;
      }

      throw new Error(
        `Failed to start dev server: ${error?.message || error}\n` +
        `Output: ${allOutput.slice(-2000)}`
      );
    }
  }

  /**
   * Get the current dev server URL if one is running
   */
  getServerUrl(): string | null {
    return this.serverUrl;
  }

  /**
   * Install npm packages
   */
  async installPackage(
    packages: string[], 
    options?: { dev?: boolean; retryIndividual?: boolean }
  ): Promise<{ success: boolean; output?: string; error?: string; packageJson?: string }> {
    const container = await this.getWebContainer();
    
    const retryIndividual = options?.retryIndividual ?? false;
    const isDev = options?.dev ?? false;

    console.log(`[installPackage] Installing packages: ${packages.join(', ')} (${isDev ? 'dev' : 'production'} dependencies)`);

    // Try installing all packages together
    const installArgs = ["install", isDev ? "--save-dev" : "--save", ...packages];
    const installProcess = await container.spawn("npm", installArgs);

    // Capture output
    const outputChunks: string[] = [];

    const outputPromise = installProcess.output.pipeTo(
      new WritableStream({
        write: (data) => {
          const text = typeof data === 'string'
            ? data
            : (data as any) instanceof Uint8Array
              ? new TextDecoder().decode(data)
              : String(data);

          outputChunks.push(text);
          console.log("[npm install]", text);
        },
      })
    ).catch((err) => {
      console.error("[npm install] Stream error:", err);
    });

    // Wait for process to exit with timeout
    const INSTALL_TIMEOUT = 120000;
    const exitCode = await Promise.race([
      installProcess.exit,
      new Promise<number>((_, reject) => 
        setTimeout(() => reject(new Error(`npm install timed out after ${INSTALL_TIMEOUT}ms`)), INSTALL_TIMEOUT)
      )
    ]).catch((error) => {
      console.error("[npm install] Timeout occurred, killing process");
      installProcess.kill();
      throw error;
    });

    await new Promise(resolve => setTimeout(resolve, 200));

    try {
      await Promise.race([
        outputPromise,
        new Promise((resolve) => setTimeout(resolve, 2000))
      ]);
    } catch (err) {
      console.warn("[npm install] Stream wait warning:", err);
    }

    const allOutput = outputChunks.join('');

    if (exitCode !== 0) {
      // Handle 404 errors by trying individual packages
      const is404Error = allOutput.includes('404') ||
        allOutput.includes('Not found') ||
        allOutput.includes('is not in this registry');

      if (is404Error && packages.length > 1 && !retryIndividual) {
        // Try installing packages individually
        const individualResults: { pkg: string; success: boolean }[] = [];

        for (const pkg of packages) {
          try {
            const result = await this.installPackage([pkg], { retryIndividual: true, dev: isDev });
            individualResults.push({ pkg, success: result.success });
          } catch {
            individualResults.push({ pkg, success: false });
          }
        }

        const succeeded = individualResults.filter(r => r.success).map(r => r.pkg);
        const failed = individualResults.filter(r => !r.success).map(r => r.pkg);

        if (succeeded.length > 0) {
          // Clear Vite cache
          await this.clearViteCache();
          
          try {
            const packageJson = await this.readFile("package.json");
            return {
              success: true,
              output: `Successfully installed: ${succeeded.join(', ')}${failed.length > 0 ? `. Failed: ${failed.join(', ')}` : ''}`,
              packageJson
            };
          } catch {
            return {
              success: true,
              output: `Successfully installed: ${succeeded.join(', ')}${failed.length > 0 ? `. Failed: ${failed.join(', ')}` : ''}`
            };
          }
        }
      }

      const errorMatch = allOutput.match(/npm ERR!.*/g);
      const errorDetails = errorMatch
        ? errorMatch.join('\n')
        : allOutput.slice(-1000);

      return {
        success: false,
        error: `Package installation failed with exit code ${exitCode}.\n` +
          `Packages: ${packages.join(', ')}\n` +
          `Error details:\n${errorDetails}`
      };
    }

    console.log(`[installPackage] Successfully installed: ${packages.join(', ')}`);

    // Clear Vite cache
    await this.clearViteCache();

    // Read updated package.json
    try {
      const packageJson = await this.readFile("package.json");
      return {
        success: true,
        output: `Successfully installed packages: ${packages.join(', ')}`,
        packageJson
      };
    } catch {
      return {
        success: true,
        output: `Successfully installed packages: ${packages.join(', ')}`
      };
    }
  }

  /**
   * Clear Vite cache to force re-optimization
   */
  private async clearViteCache(): Promise<void> {
    try {
      const container = await this.getWebContainer();
      const viteCachePath = "node_modules/.vite";
      try {
        await container.fs.rm(viteCachePath, { recursive: true, force: true });
        console.log(`[clearViteCache] Cleared Vite cache directory`);
      } catch (rmError: any) {
        if (!rmError?.message?.includes('ENOENT') &&
          !rmError?.message?.includes('not found') &&
          !rmError?.message?.includes('ENOTDIR')) {
          console.warn(`[clearViteCache] Failed to clear Vite cache:`, rmError);
        }
      }
    } catch (error) {
      console.warn(`[clearViteCache] Failed to clear Vite cache:`, error);
    }
  }

  /**
   * Register an error callback
   */
  addErrorCallback(callback: ErrorCallback): () => void {
    this.errorCallbacks.add(callback);
    // Return unsubscribe function
    return () => {
      this.errorCallbacks.delete(callback);
    };
  }

  /**
   * Remove an error callback
   */
  removeErrorCallback(callback: ErrorCallback): void {
    this.errorCallbacks.delete(callback);
  }

  /**
   * Trigger all registered error callbacks
   */
  private triggerErrorCallbacks(error: string): void {
    for (const callback of this.errorCallbacks) {
      try {
        callback(error);
      } catch (err) {
        console.error("[triggerErrorCallbacks] Error in callback:", err);
      }
    }
  }

  async destroy(): Promise<void> {
    // Kill dev process if running
    if (this.devProcess) {
      try {
        this.devProcess.kill();
      } catch (error) {
        console.warn("[destroy] Error killing dev process:", error);
      }
      this.devProcess = null;
    }

    // Close all file watchers
    this.watchers.forEach(watcher => {
      try {
        watcher.close();
      } catch (error) {
        console.warn("[destroy] Error closing watcher:", error);
      }
    });
    this.watchers.clear();

    // Unsubscribe from all events
    this.eventUnsubscribers.forEach(unsub => {
      try {
        unsub();
      } catch (error) {
        console.warn("[destroy] Error unsubscribing from event:", error);
      }
    });
    this.eventUnsubscribers = [];

    // Note: We don't destroy the singleton WebContainer instance
    // as it may be shared across multiple sandbox instances
    // Only clear instance-specific state
    this.webcontainer = null;
    this.ports.clear();
    this.consoleLogs = [];
    this.serverUrl = null;
    this.errorCallbacks.clear();
  }

  private addLog(level: LogEntry['level'], message: string, source?: string): void {
    const logEntry: LogEntry = {
      timestamp: Date.now(),
      level,
      message,
      source,
    };
    this.consoleLogs.push(logEntry);
    
    // Limit log storage to prevent memory issues
    if (this.consoleLogs.length > this.MAX_LOG_ENTRIES) {
      this.consoleLogs = this.consoleLogs.slice(-this.MAX_LOG_ENTRIES);
    }
  }
}

