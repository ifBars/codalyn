"use client";

import { WebContainer, type FileSystemTree } from "@webcontainer/api";
import {
  projectTemplateTree,
  templateRootFiles,
} from "./project-template";

/**
 * WebContainer Manager for running Vite + React + Tailwind projects in-browser
 * We should abstract this to the sandbox package for maintainability
 */
export class WebContainerManager {
  private static instance: WebContainer | null = null;
  private static bootPromise: Promise<WebContainer> | null = null;
  private static devProcess: any | null = null;
  private static serverUrl: string | null = null;
  private static initPromise: Promise<{ container: WebContainer; url: string }> | null = null;
  private static isInitialized: boolean = false;
  private static errorCallback: ((error: string) => void) | null = null;
  private static currentProjectFilesHash: string | null = null;
  private static currentProjectId: string | null = null;

  /**
   * Register a callback to be called when internal server errors are detected
   * @param callback Function to call with error message
   */
  static setErrorCallback(callback: ((error: string) => void) | null): void {
    this.errorCallback = callback;
  }

  static async getInstance(): Promise<WebContainer> {
    if (this.instance) {
      return this.instance;
    }

    if (this.bootPromise) {
      return this.bootPromise;
    }

    this.bootPromise = WebContainer.boot();
    this.instance = await this.bootPromise;
    return this.instance;
  }

  /**
   * Initialize a new Vite + React + Tailwind project
   * @param savedFiles Optional saved project files to merge with template
   * @param projectId Optional project ID to track which project is loaded
   */
  static async initProject(savedFiles?: Record<string, string>, projectId?: string): Promise<{
    container: WebContainer;
    url: string;
  }> {
    // Calculate hash of provided files to detect project changes
    const filesHash = savedFiles ? JSON.stringify(Object.keys(savedFiles).sort().map(k => `${k}:${savedFiles[k]?.substring(0, 100)}`)).substring(0, 200) : null;
    const isDifferentProject = (filesHash && filesHash !== this.currentProjectFilesHash) ||
      (projectId && projectId !== this.currentProjectId);

    // If already initialized but switching to a different project, replace files
    if (this.isInitialized && this.serverUrl && this.devProcess && isDifferentProject && savedFiles) {
      console.log(`[init] Switching to different project (ID: ${projectId}), replacing files...`);
      try {
        // Replace project files
        await this.replaceProjectFiles(savedFiles);
        this.currentProjectFilesHash = filesHash;
        this.currentProjectId = projectId || null;
        const container = await this.getInstance();
        return { container, url: this.serverUrl };
      } catch (error) {
        console.warn(`[init] Failed to replace project files, reinitializing:`, error);
        // Fall through to reinitialize if replace fails
        this.isInitialized = false;
        this.serverUrl = null;
        this.devProcess = null;
        this.currentProjectFilesHash = null;
        this.currentProjectId = null;
      }
    }

    // If already initialized with the same project, return existing instance
    if (this.isInitialized && this.serverUrl && this.devProcess && !isDifferentProject) {
      const container = await this.getInstance();
      return { container, url: this.serverUrl };
    }

    // If initialization is in progress, wait for it to complete
    if (this.initPromise) {
      console.log(`[init] Initialization already in progress, waiting...`);
      return this.initPromise;
    }

    // Start initialization
    this.initPromise = this._doInit(savedFiles);
    
    try {
      const result = await this.initPromise;
      this.isInitialized = true;
      this.currentProjectFilesHash = filesHash;
      this.currentProjectId = projectId || null;
      // Clear init promise after successful initialization
      this.initPromise = null;
      return result;
    } catch (error) {
      // Reset init promise on error so we can retry
      this.initPromise = null;
      throw error;
    }
  }

  /**
   * Internal initialization method
   * @param savedFiles Optional saved project files to merge with template
   */
  private static async _doInit(savedFiles?: Record<string, string>): Promise<{
    container: WebContainer;
    url: string;
  }> {
    const container = await this.getInstance();

    // Kill any existing dev process before starting a new one
    if (this.devProcess) {
      console.log(`[init] Killing existing dev process...`);
      try {
        this.devProcess.kill();
        // Wait a bit for the process to terminate
        await new Promise(resolve => setTimeout(resolve, 500));
      } catch (error) {
        console.warn(`[init] Error killing existing dev process:`, error);
      }
      this.devProcess = null;
      this.serverUrl = null;
      this.isInitialized = false; // Reset initialization state since we're starting fresh
      this.currentProjectFilesHash = null; // Reset project hash
      this.currentProjectId = null; // Reset project ID
    }

    // Prepare files to mount - merge template with saved files if provided
    let filesToMount: FileSystemTree;

    if (savedFiles && Object.keys(savedFiles).length > 0) {
      // Convert saved files (FlatFileMap) to FileSystemTree format
      const savedTree: FileSystemTree = {};
      for (const [path, content] of Object.entries(savedFiles)) {
        const parts = path.split('/').filter(p => p.length > 0);
        if (parts.length === 0) continue;

        let current: any = savedTree;

        // Navigate/create directory structure
        for (let i = 0; i < parts.length - 1; i++) {
          const part = parts[i];
          if (!current[part]) {
            current[part] = { directory: {} };
          }
          if (!('directory' in current[part])) {
            // If it's a file, convert to directory
            current[part] = { directory: {} };
          }
          current = current[part].directory;
        }

        // Add file
        const fileName = parts[parts.length - 1];
        current[fileName] = { file: { contents: content } };
      }

      // Merge: saved files take precedence, especially package.json
      const mergeTree = (template: FileSystemTree, saved: FileSystemTree): FileSystemTree => {
        const merged: FileSystemTree = { ...template };

        for (const [key, value] of Object.entries(saved)) {
          if ('file' in (value as any)) {
            // File: saved version takes precedence
            merged[key] = value;
          } else if ('directory' in (value as any)) {
            // Directory: merge recursively
            const existingNode = merged[key];
            if (existingNode && 'directory' in existingNode) {
              merged[key] = {
                directory: mergeTree(existingNode.directory, (value as any).directory)
              };
            } else {
              merged[key] = value;
            }
          }
        }

        return merged;
      };

      filesToMount = mergeTree(projectTemplateTree, savedTree);

      // Ensure package.json from saved files is used (preserves dependencies)
      if (savedFiles['package.json']) {
        try {
          const savedPkgJson = JSON.parse(savedFiles['package.json']);
          const templatePkgJson = JSON.parse(
            (projectTemplateTree['package.json'] as any)?.file?.contents || '{}'
          );

          // Merge dependencies: saved takes precedence, but ensure template structure exists
          const mergedPkgJson = {
            ...templatePkgJson,
            ...savedPkgJson,
            dependencies: {
              ...(templatePkgJson.dependencies || {}),
              ...(savedPkgJson.dependencies || {}),
            },
            devDependencies: {
              ...(templatePkgJson.devDependencies || {}),
              ...(savedPkgJson.devDependencies || {}),
            },
          };

          (filesToMount['package.json'] as any) = {
            file: {
              contents: JSON.stringify(mergedPkgJson, null, 2),
            },
          };

          console.log(`[init] Merged package.json with ${Object.keys(mergedPkgJson.dependencies || {}).length} dependencies and ${Object.keys(mergedPkgJson.devDependencies || {}).length} devDependencies`);
        } catch (e) {
          console.warn('[init] Failed to merge package.json, using saved version:', e);
          // Use saved package.json as-is if merge fails
          if (savedTree['package.json']) {
            filesToMount['package.json'] = savedTree['package.json'];
          }
        }
      }

      // Fix vite.config.ts if it has the old path-based imports
      // This ensures compatibility with WebContainer's ESM environment
      if (savedFiles['vite.config.ts']) {
        const savedViteConfig = savedFiles['vite.config.ts'];
        if (savedViteConfig.includes('import path') || savedViteConfig.includes("require('path')") || savedViteConfig.includes('path.resolve')) {
          console.log('[init] Fixing vite.config.ts to remove path module usage...');
          // Replace old path-based imports with URL-based approach
          let fixedConfig = savedViteConfig
            .replace(/import\s+path\s+from\s+['"]path['"][^\n]*\n?/g, '')
            .replace(/import\s*{\s*fileURLToPath\s*}\s+from\s+['"]url['"][^\n]*\n?/g, '')
            .replace(/const\s+__dirname\s*=\s*path\.dirname\(fileURLToPath\(import\.meta\.url\)\)[^\n]*\n?/g, '')
            .replace(/path\.resolve\(__dirname,\s*['"]\.\/src['"]\)/g, `new URL('./src', import.meta.url).pathname`)
            .replace(/path\.resolve\(__dirname,\s*['"]\.\/src['"]\)/g, `new URL('./src', import.meta.url).pathname`);

          // Ensure resolve.alias exists with correct format
          if (!fixedConfig.includes("resolve:")) {
            fixedConfig = fixedConfig.replace(
              /plugins:\s*\[react\(\)\],/,
              `plugins: [react()],\n  resolve: {\n    alias: {\n      '@': new URL('./src', import.meta.url).pathname,\n    },\n  },`
            );
          } else if (!fixedConfig.includes("'@':") && !fixedConfig.includes('"@":')) {
            // Add alias if resolve exists but alias doesn't
            fixedConfig = fixedConfig.replace(
              /resolve:\s*\{/,
              `resolve: {\n    alias: {\n      '@': new URL('./src', import.meta.url).pathname,\n    },`
            );
          }

          (filesToMount['vite.config.ts'] as any) = {
            file: {
              contents: fixedConfig,
            },
          };

          // Also update savedFiles so it gets saved back to storage
          savedFiles['vite.config.ts'] = fixedConfig;

          console.log('[init] Fixed vite.config.ts to use URL-based path resolution');
        }
      }
    } else {
      filesToMount = projectTemplateTree;
    }

    // Mount the project files
    await container.mount(filesToMount);

    // Install dependencies
    console.log("Installing dependencies...");

    // Read package.json to see what dependencies need to be installed
    let packageJson: any = null;
    try {
      const pkgJsonContent = await this.readFile("package.json");
      packageJson = JSON.parse(pkgJsonContent);
      const depCount = Object.keys(packageJson.dependencies || {}).length;
      const devDepCount = Object.keys(packageJson.devDependencies || {}).length;
      console.log(`[init] Installing ${depCount} dependencies and ${devDepCount} devDependencies...`);
    } catch (e) {
      console.warn('[init] Could not read package.json before install:', e);
    }

    const installProcess = await container.spawn("npm", ["install"]);

    // Wait for install to complete
    const installExitCode = await installProcess.exit;
    if (installExitCode !== 0) {
      throw new Error("Failed to install dependencies");
    }

    console.log("Starting dev server...");

    // Start dev server
    const devProcess = await container.spawn("npm", ["run", "dev"]);
    this.devProcess = devProcess;

    // Capture output to detect when server is ready
    const outputChunks: string[] = [];
    let serverUrl: string | null = null;
    let serverReady = false;

    // Set up server-ready event listener (WebContainer API)
    // The `on` method returns an unsubscribe function
    const serverReadyListener = (port: number, url: string) => {
      console.log(`[server] Server ready event on port ${port} at ${url}`);
      serverUrl = url;
      serverReady = true;
    };
    const unsubscribeServerReady = container.on("server-ready", serverReadyListener);

    // Also parse output to detect Vite server startup
    const outputPromise = devProcess.output.pipeTo(
      new WritableStream({
        write(data) {
          // Convert data to string
          const text = typeof data === 'string'
            ? data
            : (data as any) instanceof Uint8Array
              ? new TextDecoder().decode(data)
              : String(data);

          outputChunks.push(text);
          console.log("[vite]", text);

          // Check for Vite server ready messages
          // Vite outputs: "Local: http://localhost:5173/" or "➜  Local:   http://localhost:5173/"
          const viteUrlMatch = text.match(/Local:\s*(https?:\/\/[^\s]+)/i) ||
            text.match(/➜\s*Local:\s*(https?:\/\/[^\s]+)/i) ||
            text.match(/ready in \d+ms/i);

          if (viteUrlMatch && !serverReady) {
            const detectedUrl = viteUrlMatch[1] || `http://localhost:5173`;
            console.log(`[server] Detected Vite server ready at ${detectedUrl}`);
            serverUrl = detectedUrl;
            serverReady = true;
          }

          // Check for dependency errors and forward to Preview component
          if (text.includes('dependencies are imported but could not be resolved') ||
            text.includes('The following dependencies') ||
            text.includes('Are they installed?')) {
            // This will be caught by the Preview component's error detection
            console.warn(`[vite] Dependency error detected: ${text.substring(0, 500)}`);
          }

          // Check for config errors
          if (text.includes('failed to load config') ||
            text.includes('Dynamic require') ||
            text.includes('server restart failed')) {
            console.error(`[vite] Config error: ${text.substring(0, 500)}`);
          }

          // Check for Internal server errors
          if (text.includes('Internal server error') || 
              text.match(/500\s+Internal\s+Server\s+Error/i) ||
              text.includes('Internal Server Error')) {
            const errorMessage = WebContainerManager.extractInternalServerError(text);
            console.error(`[vite] Internal server error detected: ${errorMessage}`);
            
            // Trigger the error callback if registered
            if (WebContainerManager.errorCallback) {
              const formattedError = `Internal Server Error detected in Vite dev server:\n\n${errorMessage}`;
              WebContainerManager.errorCallback(formattedError);
            }
          }
        },
      })
    ).catch((err) => {
      console.error("[vite] Output stream error:", err);
    });

    // Wait for server to be ready with multiple strategies
    const waitForServer = (): Promise<string> => {
      return new Promise((resolve, reject) => {
        let checkInterval: NodeJS.Timeout;
        let timeout: NodeJS.Timeout;

        // Define cleanup function (using function declaration for hoisting)
        function cleanup() {
          if (checkInterval) clearInterval(checkInterval);
          if (timeout) clearTimeout(timeout);
          // Call the unsubscribe function returned by container.on()
          if (unsubscribeServerReady) {
            unsubscribeServerReady();
          }
        }

        checkInterval = setInterval(() => {
          if (serverReady && serverUrl) {
            cleanup();
            resolve(serverUrl);
          }
        }, 100);

        timeout = setTimeout(() => {
          cleanup();
          // Check if we have any output that suggests server started
          const allOutput = outputChunks.join('');
          const viteUrlMatch = allOutput.match(/Local:\s*(https?:\/\/[^\s]+)/i) ||
            allOutput.match(/➜\s*Local:\s*(https?:\/\/[^\s]+)/i);

          if (viteUrlMatch) {
            const url = viteUrlMatch[1] || `http://localhost:5173`;
            console.log(`[server] Server detected from output after timeout: ${url}`);
            resolve(url);
            return;
          }

          // Check if process is still running (exit promise hasn't resolved = still running)
          Promise.race([
            devProcess.exit,
            new Promise<number>((resolve) => setTimeout(() => resolve(-999), 100))
          ]).then((exitCode) => {
            if (exitCode === -999) {
              // Timeout means process is still running (exit promise didn't resolve)
              const url = `http://localhost:5173`;
              console.log(`[server] Process still running, assuming server on default port: ${url}`);
              resolve(url);
            } else if (exitCode === 0) {
              // Process exited successfully (unusual for dev server, but might be OK)
              const url = `http://localhost:5173`;
              console.log(`[server] Process exited with code 0, assuming server was ready: ${url}`);
              resolve(url);
            } else {
              reject(new Error(`Dev server exited with code ${exitCode}. Output: ${allOutput.slice(-2000)}`));
            }
          }).catch(() => {
            // Can't check exit code, assume server might be running
            const url = `http://localhost:5173`;
            console.log(`[server] Cannot verify exit code, assuming server on default port: ${url}`);
            resolve(url);
          });
        }, 30000); // 30 second timeout

        // Also check for process exit errors
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

    let url: string;
    try {
      url = await waitForServer();
      this.serverUrl = url;
      console.log(`[server] Server confirmed ready at ${url}`);
      return { container, url };
    } catch (error: any) {
      // Last resort: check output one more time
      const allOutput = outputChunks.join('');
      const viteUrlMatch = allOutput.match(/Local:\s*(https?:\/\/[^\s]+)/i) ||
        allOutput.match(/➜\s*Local:\s*(https?:\/\/[^\s]+)/i);

      if (viteUrlMatch) {
        url = viteUrlMatch[1] || `http://localhost:5173`;
        this.serverUrl = url;
        console.log(`[server] Server detected from output in error handler: ${url}`);
        return { container, url };
      }

      // Check if process is still running (exit promise hasn't resolved = still running)
      try {
        const exitCode = await Promise.race([
          devProcess.exit,
          new Promise<number>((resolve) => setTimeout(() => resolve(-999), 1000))
        ]);

        if (exitCode === -999) {
          // Timeout means process is still running (exit promise didn't resolve)
          url = `http://localhost:5173`;
          this.serverUrl = url;
          console.log(`[server] Process appears to be running, using default URL: ${url}`);
          return { container, url };
        } else if (exitCode === 0) {
          // Process exited with 0 (unusual but might be OK)
          url = `http://localhost:5173`;
          this.serverUrl = url;
          console.log(`[server] Process exited with 0, assuming server was ready: ${url}`);
          return { container, url };
        }
        // Non-zero exit code means failure, which is already handled above
      } catch {
        // Can't check, assume server might be running
        url = `http://localhost:5173`;
        this.serverUrl = url;
        console.log(`[server] Cannot verify process status, using default URL: ${url}`);
        return { container, url };
      }

      throw new Error(
        `Failed to start dev server: ${error?.message || error}\n` +
        `Output: ${allOutput.slice(-2000)}`
      );
    }
  }

  /**
   * Write a file to the container
   * Automatically creates parent directories if they don't exist
   */
  static async writeFile(path: string, content: string): Promise<void> {
    const container = await this.getInstance();

    // Normalize path - ensure consistent forward slashes
    // Remove leading slash if present (WebContainer uses relative paths from root)
    const normalizedPath = path.replace(/^\/+/, '').replace(/\/+/g, '/');

    // Extract directory path and create it if needed
    const dirPath = normalizedPath.split('/').slice(0, -1).join('/');
    if (dirPath) {
      // Create parent directories recursively
      // First try recursive mkdir (most efficient)
      try {
        await container.fs.mkdir(dirPath, { recursive: true });
      } catch (e: any) {
        // If recursive fails, try creating directories one by one as fallback
        // This handles cases where recursive might not work as expected
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
              // Re-throw non-exists errors
              throw dirError;
            }
            // Otherwise, directory exists, continue
          }
        }
      }
    }

    // Write the file - wrap in try-catch to provide better error messages
    try {
      await container.fs.writeFile(normalizedPath, content);
    } catch (error: any) {
      // Provide more context if write fails
      throw new Error(
        `Failed to write file "${normalizedPath}": ${error?.message || error}. ` +
        `Directory path: "${dirPath}"`
      );
    }
  }

  /**
   * Install npm packages
   * Handles missing packages gracefully by installing packages individually
   * @param packages Array of package names to install
   * @param options Options for installation (dev dependencies, retry flag)
   * @returns Updated package.json content, or null if installation failed
   */
  static async installPackage(
    packages: string[], 
    options?: { dev?: boolean; retryIndividual?: boolean }
  ): Promise<string | null> {
    const container = await this.getInstance();
    const retryIndividual = options?.retryIndividual ?? false;
    const isDev = options?.dev ?? false;

    console.log(`[install] Installing packages: ${packages.join(', ')} (${isDev ? 'dev' : 'production'} dependencies)`);

    // First, try installing all packages together
    const installArgs = ["install", isDev ? "--save-dev" : "--save", ...packages];
    const installProcess = await container.spawn("npm", installArgs);

    // Capture output for error reporting and verification
    const outputChunks: string[] = [];
    let streamClosed = false;
    let installSuccess = false;

    const outputPromise = installProcess.output.pipeTo(
      new WritableStream({
        write(data) {
          // Convert data to string - WebContainer output is typically string
          const text = typeof data === 'string'
            ? data
            : (data as any) instanceof Uint8Array
              ? new TextDecoder().decode(data)
              : String(data);

          outputChunks.push(text);
          console.log("[npm install]", text);

          // Check for success indicators in output
          if (text.includes('added') || text.includes('up to date') || text.includes('packages')) {
            installSuccess = true;
          }
        },
        close() {
          streamClosed = true;
        },
        abort(err) {
          console.error("[npm install] Stream aborted:", err);
          streamClosed = true;
        },
      })
    ).catch((err) => {
      console.error("[npm install] Stream error:", err);
      streamClosed = true;
    });

    // Wait for process to exit with timeout (npm install can take a while, but shouldn't hang forever)
    const INSTALL_TIMEOUT = 120000; // 2 minutes - reasonable for most packages
    const exitCode = await Promise.race([
      installProcess.exit,
      new Promise<number>((_, reject) => 
        setTimeout(() => reject(new Error(`npm install timed out after ${INSTALL_TIMEOUT}ms`)), INSTALL_TIMEOUT)
      )
    ]).catch((error) => {
      // If timeout occurs, kill the process and throw
      console.error("[npm install] Timeout occurred, killing process");
      installProcess.kill();
      throw error;
    });

    // Give a small delay to ensure all output is flushed
    await new Promise(resolve => setTimeout(resolve, 200));

    // Wait for stream to close (with shorter timeout since process already exited)
    try {
      await Promise.race([
        outputPromise,
        new Promise((resolve) => setTimeout(resolve, 2000)) // 2 second timeout for stream flush
      ]);
    } catch (err) {
      // Stream might have already closed, that's okay
      console.warn("[npm install] Stream wait warning:", err);
    }

    // Combine all output for analysis
    const allOutput = outputChunks.join('');

    if (exitCode !== 0) {
      // Check if this is a 404 error (package not found)
      const is404Error = allOutput.includes('404') ||
        allOutput.includes('Not found') ||
        allOutput.includes('is not in this registry');

      if (is404Error) {
        // Extract which packages failed (404 errors)
        const failedPackages: string[] = [];
        const successfulPackages: string[] = [];

        // Try to identify which packages failed by checking error messages
        for (const pkg of packages) {
          // Check if this package is mentioned in 404 errors
          const pkgEscaped = pkg.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
          const pkgErrorPattern = new RegExp(`404.*${pkgEscaped}|${pkgEscaped}.*404|${pkgEscaped}.*not found|not found.*${pkgEscaped}`, 'i');

          if (pkgErrorPattern.test(allOutput)) {
            failedPackages.push(pkg);
            console.warn(`[install] Package not found (404): ${pkg}`);
          } else {
            successfulPackages.push(pkg);
          }
        }

        // If we have some successful packages, try installing them individually
        if (successfulPackages.length > 0 && failedPackages.length > 0 && !retryIndividual) {
          console.log(`[install] Some packages failed (404). Retrying with valid packages: ${successfulPackages.join(', ')}`);

          // Install successful packages individually (with retry flag to prevent recursion)
          for (const pkg of successfulPackages) {
            try {
              await this.installPackage([pkg], { retryIndividual: true, dev: isDev });
            } catch (individualError) {
              console.warn(`[install] Failed to install ${pkg} individually:`, individualError);
              failedPackages.push(pkg);
            }
          }

          // If we successfully installed at least some packages, don't throw
          // Just log a warning about the failed ones
          const actuallySucceeded = successfulPackages.filter(p => !failedPackages.includes(p));
          if (actuallySucceeded.length > 0) {
            console.warn(`[install] Some packages could not be installed: ${failedPackages.join(', ')}`);
            console.log(`[install] Successfully installed: ${actuallySucceeded.join(', ')}`);
            // Read and return updated package.json even for partial success
            try {
              return await this.readFile("package.json");
            } catch {
              return null;
            }
          }
        }

        // If all packages failed or we couldn't determine which ones succeeded
        // Try installing packages individually to get better error messages (only if not already retrying)
        if (packages.length > 1 && !retryIndividual) {
          console.log(`[install] Attempting to install packages individually to identify failures...`);
          const individualResults: { pkg: string; success: boolean }[] = [];

          for (const pkg of packages) {
            try {
              await this.installPackage([pkg], { retryIndividual: true, dev: isDev }); // Set retry flag to prevent infinite recursion
              individualResults.push({ pkg, success: true });
            } catch (individualError: any) {
              individualResults.push({ pkg, success: false });
              console.warn(`[install] Failed to install ${pkg}:`, individualError?.message || individualError);
            }
          }

          const succeeded = individualResults.filter(r => r.success).map(r => r.pkg);
          const failed = individualResults.filter(r => !r.success).map(r => r.pkg);

          if (succeeded.length > 0) {
            console.log(`[install] Successfully installed: ${succeeded.join(', ')}`);
            if (failed.length > 0) {
              console.warn(`[install] Failed to install: ${failed.join(', ')}`);
              // Don't throw if at least some packages succeeded
              // Read and return updated package.json
              try {
                return await this.readFile("package.json");
              } catch {
                return null;
              }
            }
          }
        }
      }

      // If we get here, installation failed completely
      // Try to extract meaningful error from output
      const errorMatch = allOutput.match(/npm ERR!.*/g);
      const errorDetails = errorMatch
        ? errorMatch.join('\n')
        : allOutput.slice(-1000); // Last 1000 chars if no npm ERR! found

      // If we have no output captured, try to get stderr if available
      const finalErrorDetails = errorDetails || allOutput || 'No error output captured';

      throw new Error(
        `Package installation failed with exit code ${exitCode}.\n` +
        `Packages: ${packages.join(', ')}\n` +
        `Error details:\n${finalErrorDetails}`
      );
    }

    // Log full output for debugging
    if (allOutput) {
      console.log(`[install] npm install output:\n${allOutput.slice(-500)}`); // Last 500 chars
    }

    console.log(`[install] Successfully installed: ${packages.join(', ')}`);

    // Read updated package.json early so we can return it later
    let updatedPackageJson: string | null = null;
    try {
      const packageJsonPath = "package.json";
      updatedPackageJson = await this.readFile(packageJsonPath);
      const packageJson = JSON.parse(updatedPackageJson);

      // Check if packages are in dependencies or devDependencies
      const allDeps = {
        ...(packageJson.dependencies || {}),
        ...(packageJson.devDependencies || {})
      };

      const missingPackages: string[] = [];
      for (const pkg of packages) {
        // Extract package name (handle scoped packages like @types/node)
        const pkgName = pkg.split('@')[0] === '' ? pkg.split('@').slice(0, 2).join('@') : pkg.split('@')[0];
        if (!allDeps[pkgName] && !allDeps[pkg]) {
          missingPackages.push(pkg);
        }
      }

      if (missingPackages.length > 0) {
        console.warn(`[install] Warning: Some packages may not be in package.json: ${missingPackages.join(', ')}`);
        console.warn(`[install] This might happen if npm install failed silently or packages weren't saved`);
      } else {
        console.log(`[install] Verified packages are in package.json`);
      }
    } catch (verifyError) {
      console.warn(`[install] Failed to verify package installation:`, verifyError);
      // Still try to read package.json even if verification failed
      try {
        updatedPackageJson = await this.readFile("package.json");
      } catch {
        updatedPackageJson = null;
      }
    }

    // After installing packages, we need to trigger Vite to re-optimize dependencies
    // Vite caches optimized dependencies in node_modules/.vite
    // Clearing this cache forces Vite to re-optimize on the next request
    try {
      // Clear Vite's dependency cache - this is critical for Vite to detect new packages
      const viteCachePath = "node_modules/.vite";
      try {
        await this.rm(viteCachePath, { recursive: true });
        console.log(`[install] Cleared Vite cache directory`);
      } catch (rmError: any) {
        // Cache directory might not exist yet, which is fine
        if (!rmError?.message?.includes('ENOENT') &&
          !rmError?.message?.includes('not found') &&
          !rmError?.message?.includes('ENOTDIR')) {
          console.warn(`[install] Failed to clear Vite cache:`, rmError);
        }
      }

      // Read and rewrite package.json to trigger Vite's file watcher
      // This ensures Vite detects the package.json change and re-runs dependency optimization
      try {
        const packageJsonPath = "package.json";
        const packageJsonContent = await this.readFile(packageJsonPath);
        const packageJson = JSON.parse(packageJsonContent);

        // Add a comment or whitespace change to ensure file watcher detects the change
        // This is more reliable than just reformatting
        const formattedJson = JSON.stringify(packageJson, null, 2) + '\n';
        await this.writeFile(packageJsonPath, formattedJson);

        console.log(`[install] Updated package.json to trigger Vite file watcher`);
      } catch (touchError) {
        console.warn(`[install] Failed to touch package.json:`, touchError);
      }

      // Force Vite to re-optimize dependencies
      // Strategy: Create a temporary import file that Vite will process
      // IMPORTANT: We NEVER make HTTP requests from the browser due to CORS restrictions
      // All file operations use WebContainer's file system API
      // Vite will process the file automatically when accessed through the iframe/preview
      try {
        // Wait a moment for package.json change to be detected
        await new Promise(resolve => setTimeout(resolve, 500));

        // Create a temporary import file to force Vite to resolve packages
        // This ensures Vite processes the imports when the preview refreshes
        // We use file system operations only - NO HTTP requests
        try {
          // Ensure src directory exists
          try {
            await container.fs.mkdir("src", { recursive: true });
          } catch (mkdirError: any) {
            // Directory might already exist, which is fine
            if (!mkdirError?.message?.includes('EEXIST') &&
              !mkdirError?.message?.includes('already exists')) {
              console.warn(`[install] Failed to create src directory:`, mkdirError);
            }
          }

          // Create a temporary file that imports all newly installed packages
          // This forces Vite to resolve and optimize them when the file is accessed
          const tempImportPath = "src/__vite_temp_import__.ts";
          const importStatements = packages
            .map(pkg => {
              // Extract package name (handle scoped packages like @types/node)
              const pkgName = pkg.split('@')[0] === ''
                ? pkg.split('@').slice(0, 2).join('@')
                : pkg.split('@')[0];
              return `import '${pkgName}';`;
            })
            .join('\n');

          // Create temporary import file using file system API (NOT HTTP)
          await this.writeFile(tempImportPath, importStatements);
          console.log(`[install] Created temporary import file to force Vite optimization`);
          console.log(`[install] Vite will process dependencies when the preview refreshes`);

          // Clean up the temporary file after Vite has had time to process it
          // Give it enough time for Vite to optimize dependencies
          setTimeout(async () => {
            try {
              await this.rm(tempImportPath);
              console.log(`[install] Cleaned up temporary import file`);
            } catch (e) {
              // Ignore cleanup errors
            }
          }, 10000); // Give Vite time to process the imports

          // CRITICAL: We do NOT make HTTP requests from browser due to CORS
          // The preview iframe will trigger Vite to process the file when it loads/refreshes
          // All file verification uses WebContainer's file system API, not fetch()
        } catch (tempFileError) {
          console.warn(`[install] Failed to create temp import file:`, tempFileError);
        }
      } catch (optimizeError) {
        // Silently handle optimization errors - they're not critical
        // Package installation succeeded, optimization is just a performance improvement
        console.warn(`[install] Failed to force Vite optimization (non-critical):`, optimizeError);
      }

      // Also try to verify node_modules exists for at least one package
      // This helps confirm installation actually happened
      if (packages.length > 0) {
        try {
          const firstPkg = packages[0].split('@')[0] === ''
            ? packages[0].split('@').slice(0, 2).join('@')
            : packages[0].split('@')[0];
          const nodeModulesPath = `node_modules/${firstPkg}`;
          try {
            await this.readdir(nodeModulesPath);
            console.log(`[install] Verified package exists in node_modules: ${firstPkg}`);
          } catch {
            console.warn(`[install] Warning: Could not verify ${firstPkg} in node_modules`);
          }
        } catch (checkError) {
          // Ignore - verification is optional
        }
      }
    } catch (error) {
      console.warn(`[install] Failed to trigger Vite re-optimization:`, error);
      // Don't throw - package installation succeeded, this is just optimization
    }

    // Return the updated package.json content so caller can save it to project storage
    return updatedPackageJson;
  }

  /**
   * Read a file from the container
   */
  static async readFile(path: string): Promise<string> {
    const container = await this.getInstance();
    return await container.fs.readFile(path, "utf-8");
  }

  /**
   * List directory contents
   */
  static async readdir(path: string): Promise<string[]> {
    const container = await this.getInstance();
    const entries = await container.fs.readdir(path, { withFileTypes: true });
    return entries.map((e) => e.name);
  }

  /**
   * Remove a file or directory
   */
  static async rm(path: string, options?: { recursive?: boolean }): Promise<void> {
    const container = await this.getInstance();
    if (options?.recursive) {
      await container.fs.rm(path, { recursive: true, force: true });
    } else {
      await container.fs.rm(path);
    }
  }

  /**
   * Replace the scaffold with a saved project state
   * Also installs dependencies from package.json if present
   */
  static async replaceProjectFiles(fileMap: Record<string, string>): Promise<void> {
    const container = await this.getInstance();
    try {
      await this.rm("src", { recursive: true });
    } catch {
      // Ignore missing src dir
    }

    for (const rootFile of templateRootFiles) {
      try {
        await container.fs.rm(rootFile);
      } catch {
        // Ignore
      }
    }

    for (const [path, content] of Object.entries(fileMap)) {
      await this.writeFile(path, content);
    }

    // After replacing files, install dependencies from package.json
    // This ensures all packages are installed when opening an existing project
    try {
      const packageJsonContent = await this.readFile("package.json");
      const packageJson = JSON.parse(packageJsonContent);
      const depCount = Object.keys(packageJson.dependencies || {}).length;
      const devDepCount = Object.keys(packageJson.devDependencies || {}).length;

      if (depCount > 0 || devDepCount > 0) {
        console.log(`[replaceProjectFiles] Installing ${depCount} dependencies and ${devDepCount} devDependencies...`);

        const installProcess = await container.spawn("npm", ["install"]);

        // Capture output for debugging
        const outputChunks: string[] = [];
        installProcess.output.pipeTo(
          new WritableStream({
            write(data) {
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

        // Wait for install to complete
        const installExitCode = await installProcess.exit;

        // Give a small delay to ensure all output is flushed
        await new Promise(resolve => setTimeout(resolve, 200));

        if (installExitCode !== 0) {
          const allOutput = outputChunks.join('');
          console.error(`[replaceProjectFiles] npm install failed with exit code ${installExitCode}`);
          console.error(`[replaceProjectFiles] Output: ${allOutput.slice(-1000)}`);
          // Don't throw - allow project to load even if install fails
          // The user can manually install packages or fix issues
        } else {
          console.log(`[replaceProjectFiles] Successfully installed dependencies`);

          // Clear Vite cache to force re-optimization of dependencies
          // This ensures Vite detects newly installed packages
          try {
            const viteCachePath = "node_modules/.vite";
            await this.rm(viteCachePath, { recursive: true });
            console.log(`[replaceProjectFiles] Cleared Vite cache for dependency re-optimization`);
          } catch (cacheError: any) {
            // Cache directory might not exist yet, which is fine
            if (!cacheError?.message?.includes('ENOENT') &&
              !cacheError?.message?.includes('not found') &&
              !cacheError?.message?.includes('ENOTDIR')) {
              console.warn(`[replaceProjectFiles] Failed to clear Vite cache:`, cacheError);
            }
          }
        }
      } else {
        console.log(`[replaceProjectFiles] No dependencies to install`);
      }
    } catch (error: any) {
      // If package.json doesn't exist or can't be read, that's okay
      // The project might not have dependencies yet
      if (error?.message?.includes('ENOENT') || error?.message?.includes('not found')) {
        console.log(`[replaceProjectFiles] No package.json found, skipping dependency installation`);
      } else {
        console.warn(`[replaceProjectFiles] Failed to install dependencies:`, error);
        // Don't throw - allow project to load even if install fails
      }
    }
  }

  /**
   * Extract internal server error details from Vite output
   * @param outputText The output text from Vite
   * @returns Formatted error message
   */
  static extractInternalServerError(outputText: string): string {
    // Try to extract the error message and stack trace
    const lines = outputText.split('\n');
    const errorLines: string[] = [];
    let capturingError = false;

    for (let i = 0; i < lines.length; i++) {
      const line = lines[i];
      
      // Start capturing when we see "Internal server error"
      if (line.includes('Internal server error') || 
          line.match(/500\s+Internal\s+Server\s+Error/i) ||
          line.includes('Internal Server Error')) {
        capturingError = true;
        errorLines.push(line.trim());
        continue;
      }

      // Capture error details (stack traces, error messages, etc.)
      if (capturingError) {
        // Stop capturing at empty lines if we've captured enough context
        if (line.trim() === '' && errorLines.length > 10) {
          break;
        }
        
        // Capture error-related lines (stack traces, file paths, etc.)
        if (line.trim().length > 0) {
          errorLines.push(line.trim());
        }
        
        // Limit to reasonable size (prevent huge error dumps)
        if (errorLines.length > 50) {
          break;
        }
      }
    }

    // If we didn't capture much, try to get context around the error
    if (errorLines.length === 0) {
      const errorIndex = outputText.indexOf('Internal server error') !== -1 
        ? outputText.indexOf('Internal server error')
        : outputText.search(/500\s+Internal\s+Server\s+Error/i);
      
      if (errorIndex !== -1) {
        const contextStart = Math.max(0, errorIndex - 200);
        const contextEnd = Math.min(outputText.length, errorIndex + 1000);
        const context = outputText.substring(contextStart, contextEnd);
        return context.trim();
      }
    }

    return errorLines.length > 0 
      ? errorLines.join('\n')
      : outputText.substring(0, 1000); // Fallback to first 1000 chars
  }

  /**
   * Extract missing package names from Vite dependency error messages
   * @param errorMessage The error message from Vite
   * @returns Array of package names that need to be installed
   */
  static extractMissingPackages(errorMessage: string): string[] {
    const packages: string[] = [];

    // Pattern 1: "package-name (imported by /path/to/file)"
    // Example: "lucide-react (imported by /home/.../src/components/Cards.tsx)"
    const packagePattern1 = /^\s*([a-zA-Z0-9@\-_/]+)\s+\(imported by\s+[^)]+\)/gm;
    let match;
    while ((match = packagePattern1.exec(errorMessage)) !== null) {
      const pkgName = match[1].trim();
      // Filter out common false positives
      if (pkgName &&
        !pkgName.includes('/home/') &&
        !pkgName.includes('node_modules') &&
        !pkgName.startsWith('.') &&
        !pkgName.startsWith('/') &&
        pkgName.length > 1 &&
        pkgName.length < 100) {
        packages.push(pkgName);
      }
    }

    // Pattern 2: Lines that start with package names followed by "(imported by"
    // This handles cases where the package name might be on a separate line
    const lines = errorMessage.split('\n');
    for (let i = 0; i < lines.length; i++) {
      const line = lines[i].trim();
      // Check if this line contains a package name pattern
      const pkgMatch = line.match(/^([a-zA-Z0-9@\-_/]+)\s+\(imported by/);
      if (pkgMatch) {
        const pkgName = pkgMatch[1].trim();
        if (pkgName &&
          !pkgName.includes('/home/') &&
          !pkgName.includes('node_modules') &&
          !pkgName.startsWith('.') &&
          !pkgName.startsWith('/') &&
          pkgName.length > 1 &&
          pkgName.length < 100 &&
          !packages.includes(pkgName)) {
          packages.push(pkgName);
        }
      }

      // Pattern 3: Standalone package names (lines that are just package names)
      // This handles cases where packages are listed one per line
      if (/^[a-zA-Z0-9@\-_/]+$/.test(line) &&
        line.length > 1 &&
        line.length < 100 &&
        !line.includes('/home/') &&
        !line.includes('node_modules') &&
        !line.startsWith('.') &&
        !line.startsWith('/') &&
        !packages.includes(line)) {
        // Additional check: make sure it's not part of a file path
        // If the next line doesn't start with "imported by" or similar, it might be a false positive
        const nextLine = i < lines.length - 1 ? lines[i + 1].trim() : '';
        if (!nextLine.includes('imported by') && !nextLine.includes('(')) {
          // Only add if it looks like a package name (has @ or common package name patterns)
          if (line.includes('@') ||
            /^[a-z0-9\-]+$/.test(line) ||
            /^@[a-z0-9\-]+\/[a-z0-9\-]+$/.test(line)) {
            packages.push(line);
          }
        }
      }
    }

    // Pattern 4: Look for "The following dependencies are imported but could not be resolved:"
    // followed by a list of packages
    const dependenciesSection = errorMessage.match(/The following dependencies are imported but could not be resolved:([\s\S]*?)(?:Are they installed\?|$)/i);
    if (dependenciesSection) {
      const depsList = dependenciesSection[1];
      // Extract package names from the list (one per line, possibly with "(imported by ...)")
      const depLines = depsList.split('\n');
      for (const depLine of depLines) {
        const trimmed = depLine.trim();
        if (!trimmed) continue;

        // Extract package name (everything before "(imported by" or end of line)
        const pkgMatch = trimmed.match(/^([a-zA-Z0-9@\-_/]+)/);
        if (pkgMatch) {
          const pkgName = pkgMatch[1].trim();
          if (pkgName &&
            !pkgName.includes('/home/') &&
            !pkgName.includes('node_modules') &&
            !pkgName.startsWith('.') &&
            !pkgName.startsWith('/') &&
            pkgName.length > 1 &&
            pkgName.length < 100 &&
            !packages.includes(pkgName)) {
            packages.push(pkgName);
          }
        }
      }
    }

    return [...new Set(packages)]; // Remove duplicates
  }

  /**
   * Fix path alias configuration in vite.config.ts and tsconfig.json
   * This is needed when code uses @/ imports but the config files don't have the alias set up
   */
  static async fixPathAliasConfig(): Promise<void> {
    const container = await this.getInstance();

    try {
      // Fix vite.config.ts
      try {
        let viteConfig = await this.readFile("vite.config.ts");

        // Check if path alias is already configured
        const hasAlias = viteConfig.includes("'@':") || viteConfig.includes('"@":') ||
          (viteConfig.includes("resolve:") && viteConfig.includes("alias:") && viteConfig.includes("@"));

        // Also check if it's using the old path-based approach that causes errors
        // Check for various forms of path module usage
        const hasPathModule = viteConfig.includes("import path") ||
          viteConfig.includes("require('path')") ||
          viteConfig.includes('require("path")') ||
          viteConfig.includes('path.resolve') ||
          viteConfig.includes('path.dirname') ||
          viteConfig.includes('__dirname');

        if (!hasAlias || hasPathModule) {
          // Use the new URL-based approach that works in WebContainer ESM
          // Remove all path module imports and usage
          viteConfig = viteConfig.replace(
            /import\s+path\s+from\s+['"]path['"][^\n]*\n?/g,
            ''
          );
          viteConfig = viteConfig.replace(
            /import\s*{\s*fileURLToPath\s*}\s+from\s+['"]url['"][^\n]*\n?/g,
            ''
          );
          viteConfig = viteConfig.replace(
            /const\s+__dirname\s*=\s*path\.dirname\(fileURLToPath\(import\.meta\.url\)\)[^\n]*\n?/g,
            ''
          );
          // Replace path.resolve calls with URL-based approach
          viteConfig = viteConfig.replace(
            /path\.resolve\(__dirname,\s*['"]\.\/src['"]\)/g,
            `new URL('./src', import.meta.url).pathname`
          );
          viteConfig = viteConfig.replace(
            /path\.resolve\(__dirname,\s*['"]\.\/src['"]\)/g,
            `new URL('./src', import.meta.url).pathname`
          );
          // Also handle any other path.resolve patterns
          viteConfig = viteConfig.replace(
            /path\.resolve\([^)]+\)/g,
            (match) => {
              // Try to extract the path from path.resolve(__dirname, "...")
              const pathMatch = match.match(/path\.resolve\([^,]+,\s*['"]([^'"]+)['"]\)/);
              if (pathMatch) {
                return `new URL('${pathMatch[1]}', import.meta.url).pathname`;
              }
              return match; // Fallback if we can't parse it
            }
          );
          // Remove any require('path') calls
          viteConfig = viteConfig.replace(
            /const\s+path\s*=\s*require\(['"]path['"]\)[^\n]*\n?/g,
            ''
          );
          viteConfig = viteConfig.replace(
            /require\(['"]path['"]\)/g,
            ''
          );

          // Ensure resolve.alias exists with correct format
          if (!viteConfig.includes("resolve:")) {
            viteConfig = viteConfig.replace(
              /plugins: \[react\(\)\],/,
              `plugins: [react()],\n  resolve: {\n    alias: {\n      '@': new URL('./src', import.meta.url).pathname,\n    },\n  },`
            );
          } else if (!viteConfig.includes("'@':") && !viteConfig.includes('"@":')) {
            // Add alias if resolve exists but alias doesn't
            viteConfig = viteConfig.replace(
              /resolve:\s*\{/,
              `resolve: {\n    alias: {\n      '@': new URL('./src', import.meta.url).pathname,\n    },`
            );
          } else if (viteConfig.includes("plugins:")) {
            // Try to add after plugins block
            viteConfig = viteConfig.replace(
              /(plugins: \[[^\]]+\],)/,
              `$1\n  resolve: {\n    alias: {\n      '@': new URL('./src', import.meta.url).pathname,\n    },\n  },`
            );
          } else {
            // Add at start of config object
            viteConfig = viteConfig.replace(
              /export default defineConfig\(\{/,
              `export default defineConfig({\n  resolve: {\n    alias: {\n      '@': new URL('./src', import.meta.url).pathname,\n    },\n  },`
            );
          }

          await this.writeFile("vite.config.ts", viteConfig);
          console.log(`[fixPathAlias] Updated vite.config.ts with path alias configuration (using URL-based approach)`);
        } else {
          console.log(`[fixPathAlias] Path alias already configured in vite.config.ts`);
        }
      } catch (viteError: any) {
        // If vite.config.ts doesn't exist or can't be read, create a new one
        if (viteError?.message?.includes('ENOENT') || viteError?.message?.includes('not found')) {
          const defaultViteConfig = `import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: {
      '@': new URL('./src', import.meta.url).pathname,
    },
  },
  server: {
    port: 5173,
    host: true,
    strictPort: false,
  },
})`;
          await this.writeFile("vite.config.ts", defaultViteConfig);
          console.log(`[fixPathAlias] Created vite.config.ts with path alias configuration`);
        } else {
          console.warn(`[fixPathAlias] Failed to update vite.config.ts:`, viteError);
        }
      }

      // Fix tsconfig.json
      try {
        const tsConfigContent = await this.readFile("tsconfig.json");
        const tsConfig = JSON.parse(tsConfigContent);

        // Ensure compilerOptions exists
        if (!tsConfig.compilerOptions) {
          tsConfig.compilerOptions = {};
        }

        // Add paths if not present or if @/* is missing
        if (!tsConfig.compilerOptions.paths || !tsConfig.compilerOptions.paths["@/*"]) {
          tsConfig.compilerOptions.paths = {
            ...tsConfig.compilerOptions.paths,
            "@/*": ["./src/*"],
          };

          const updatedConfig = JSON.stringify(tsConfig, null, 2);
          await this.writeFile("tsconfig.json", updatedConfig);
          console.log(`[fixPathAlias] Updated tsconfig.json with path alias configuration`);
        }
      } catch (tsError: any) {
        // If tsconfig.json doesn't exist or is invalid, create/update it
        if (tsError?.message?.includes('ENOENT') || tsError?.message?.includes('not found') || tsError instanceof SyntaxError) {
          const defaultTsConfig = {
            compilerOptions: {
              target: "ES2020",
              useDefineForClassFields: true,
              lib: ["ES2020", "DOM", "DOM.Iterable"],
              module: "ESNext",
              skipLibCheck: true,
              moduleResolution: "bundler",
              allowImportingTsExtensions: true,
              resolveJsonModule: true,
              isolatedModules: true,
              noEmit: true,
              jsx: "react-jsx",
              strict: true,
              noUnusedLocals: true,
              noUnusedParameters: true,
              noFallthroughCasesInSwitch: true,
              paths: {
                "@/*": ["./src/*"],
              },
            },
            include: ["src"],
            references: [{ path: "./tsconfig.node.json" }],
          };

          await this.writeFile("tsconfig.json", JSON.stringify(defaultTsConfig, null, 2));
          console.log(`[fixPathAlias] Created/updated tsconfig.json with path alias configuration`);
        } else {
          console.warn(`[fixPathAlias] Failed to update tsconfig.json:`, tsError);
        }
      }

      // After fixing config, trigger Vite to reload
      if (this.serverUrl) {
        try {
          // Touch a file to trigger Vite reload
          await new Promise(resolve => setTimeout(resolve, 500));
          const mainTsx = await this.readFile("src/main.tsx").catch(() => null);
          if (mainTsx) {
            await this.writeFile("src/main.tsx", mainTsx + "\n");
            await this.writeFile("src/main.tsx", mainTsx);
            console.log(`[fixPathAlias] Triggered Vite reload`);
          }
        } catch (reloadError) {
          console.warn(`[fixPathAlias] Failed to trigger reload:`, reloadError);
        }
      }
    } catch (error) {
      console.error(`[fixPathAlias] Failed to fix path alias configuration:`, error);
      throw error;
    }
  }
}
