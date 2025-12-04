import { WebContainer, type FileSystemTree } from "@webcontainer/api";
import { WebContainerSandbox } from "./webcontainer";
import type { LogEntry, ErrorCallback, InitProjectOptions } from "./types";

/**
 * Singleton manager for WebContainer instances
 * Provides static convenience methods for common operations
 */
export class WebContainerManager {
  private static instance: WebContainer | null = null;
  private static bootPromise: Promise<WebContainer> | null = null;
  private static sandbox: WebContainerSandbox | null = null;
  private static errorCallbacks: Set<ErrorCallback> = new Set();

  /**
   * Get or boot WebContainer instance
   */
  static async getInstance(): Promise<WebContainer> {
    // If we have an instance, return it (even if proxy might be stale, 
    // WebContainer API will handle validation)
    if (this.instance) {
      return this.instance;
    }

    // If boot is in progress, wait for it
    if (this.bootPromise) {
      return this.bootPromise;
    }

    // Boot new instance
    this.bootPromise = WebContainer.boot();
    try {
      this.instance = await this.bootPromise;
      return this.instance;
    } catch (error) {
      // Reset boot promise on error so we can retry
      this.bootPromise = null;
      throw error;
    }
  }

  /**
   * Teardown the WebContainer instance
   * This destroys the instance and releases all resources
   * After teardown, a new instance can be booted by calling getInstance()
   */
  static teardown(): void {
    if (this.instance) {
      this.instance.teardown();
      this.instance = null;
      this.bootPromise = null;
      this.sandbox = null;
    }
  }

  /**
   * Get or create WebContainerSandbox instance
   * Note: init() is not called here to avoid race conditions
   * The sandbox will lazily initialize WebContainer when methods are called
   */
  static async getSandbox(): Promise<WebContainerSandbox> {
    if (this.sandbox) {
      return this.sandbox;
    }

    this.sandbox = new WebContainerSandbox();
    // Don't call init() here - let it initialize lazily when methods are called
    // This avoids race conditions with initProject()
    return this.sandbox;
  }

  /**
   * Initialize a project with files and optionally start dev server
   */
  static async initProject(options: InitProjectOptions & { 
    files: FileSystemTree;
  }): Promise<{ container: WebContainer; url?: string }> {
    const container = await this.getInstance();
    const sandbox = await this.getSandbox();

    // Mount files
    if (options.files) {
      await container.mount(options.files, options.mountPoint ? { mountPoint: options.mountPoint } : undefined);
    }

    // Install dependencies if requested
    if (options.installDeps !== false) {
      try {
        const packageJsonContent = await sandbox.readFile("package.json").catch(() => null);
        if (packageJsonContent) {
          const packageJson = JSON.parse(packageJsonContent);
          const depCount = Object.keys(packageJson.dependencies || {}).length;
          const devDepCount = Object.keys(packageJson.devDependencies || {}).length;
          
          if (depCount > 0 || devDepCount > 0) {
            console.log(`[initProject] Installing ${depCount} dependencies and ${devDepCount} devDependencies...`);
            const installProcess = await container.spawn("npm", ["install"]);
            const exitCode = await installProcess.exit;
            if (exitCode !== 0) {
              console.warn(`[initProject] npm install exited with code ${exitCode}`);
            } else {
              console.log(`[initProject] Dependencies installed successfully`);
            }
          }
        }
      } catch (error) {
        console.warn(`[initProject] Failed to install dependencies:`, error);
      }
    }

    // Start dev server if requested
    let url: string | undefined;
    if (options.startDevServer) {
      url = await sandbox.startDevServer(options.devServerOptions);
    }

    return { container, url };
  }

  /**
   * Replace project files in existing container
   */
  static async replaceProjectFiles(fileMap: Record<string, string>): Promise<void> {
    const sandbox = await this.getSandbox();

    // Delete src directory if it exists
    try {
      await sandbox.deletePath("src", { recursive: true });
    } catch {
      // Ignore if doesn't exist
    }

    // Write all files
    for (const [path, content] of Object.entries(fileMap)) {
      await sandbox.writeFile(path, content);
    }

    // Install dependencies from package.json if present
    try {
      const packageJsonContent = await sandbox.readFile("package.json");
      const packageJson = JSON.parse(packageJsonContent);
      const depCount = Object.keys(packageJson.dependencies || {}).length;
      const devDepCount = Object.keys(packageJson.devDependencies || {}).length;

      if (depCount > 0 || devDepCount > 0) {
        console.log(`[replaceProjectFiles] Installing ${depCount} dependencies and ${devDepCount} devDependencies...`);

        const container = await this.getInstance();
        const installProcess = await container.spawn("npm", ["install"]);

        // Capture output
        installProcess.output.pipeTo(
          new WritableStream({
            write: (data) => {
              const text = typeof data === 'string'
                ? data
                : (data as any) instanceof Uint8Array
                  ? new TextDecoder().decode(data)
                  : String(data);
              console.log("[npm install]", text);
            },
          })
        ).catch((err) => {
          console.error("[npm install] Stream error:", err);
        });

        const installExitCode = await installProcess.exit;
        await new Promise(resolve => setTimeout(resolve, 200));

        if (installExitCode !== 0) {
          console.error(`[replaceProjectFiles] npm install failed with exit code ${installExitCode}`);
        } else {
          console.log(`[replaceProjectFiles] Successfully installed dependencies`);
        }
      }
    } catch (error: any) {
      if (error?.message?.includes('ENOENT') || error?.message?.includes('not found')) {
        console.log(`[replaceProjectFiles] No package.json found, skipping dependency installation`);
      } else {
        console.warn(`[replaceProjectFiles] Failed to install dependencies:`, error);
      }
    }
  }

  /**
   * Install npm packages
   */
  static async installPackage(
    packages: string[], 
    options?: { dev?: boolean; retryIndividual?: boolean }
  ): Promise<string | null> {
    const sandbox = await this.getSandbox();
    const result = await sandbox.installPackage(packages, options);
    return result.packageJson || null;
  }

  /**
   * Read a file from the container
   */
  static async readFile(path: string): Promise<string> {
    const sandbox = await this.getSandbox();
    return sandbox.readFile(path);
  }

  /**
   * Write a file to the container
   */
  static async writeFile(path: string, content: string): Promise<void> {
    const sandbox = await this.getSandbox();
    return sandbox.writeFile(path, content);
  }

  /**
   * List directory contents
   */
  static async readdir(path: string): Promise<string[]> {
    const sandbox = await this.getSandbox();
    return sandbox.readdir(path);
  }

  /**
   * Remove a file or directory
   */
  static async rm(path: string, options?: { recursive?: boolean }): Promise<void> {
    const sandbox = await this.getSandbox();
    return sandbox.deletePath(path, options);
  }

  /**
   * Get console logs
   */
  static getConsoleLogs(options?: {
    limit?: number;
    level?: 'all' | 'error' | 'warn' | 'info';
    since?: number;
  }): Promise<LogEntry[]> {
    return this.getSandbox().then(sandbox => sandbox.getConsoleLogs(options));
  }

  /**
   * Register an error callback
   */
  static setErrorCallback(callback: ErrorCallback | null): void {
    if (callback === null) {
      // Clear all callbacks
      this.errorCallbacks.clear();
      this.getSandbox().then(sandbox => {
        // Remove callbacks from sandbox
        for (const cb of this.errorCallbacks) {
          sandbox.removeErrorCallback(cb);
        }
      });
    } else {
      this.errorCallbacks.add(callback);
      this.getSandbox().then(sandbox => {
        sandbox.addErrorCallback(callback);
      });
    }
  }

  /**
   * Get the current dev server URL if one is running
   */
  static getServerUrl(): string | null {
    return this.sandbox?.getServerUrl() || null;
  }
}

