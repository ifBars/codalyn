"use client";

import { WebContainer, type FileSystemTree } from "@webcontainer/api";
import {
  projectTemplateTree,
  templateRootFiles,
} from "./project-template";
import type { LogEntry } from "@codalyn/sandbox";
import { WebContainerManager as SandboxWebContainerManager } from "@codalyn/sandbox";

/**
 * WebContainer Manager for running Vite + React + Tailwind projects in-browser
 * Delegates core operations to @codalyn/sandbox package while maintaining
 * studio-specific functionality (project templates, path aliases, error extraction)
 */
export class WebContainerManager {
  private static initPromise: Promise<{ container: WebContainer; url: string }> | null = null;
  private static isInitialized: boolean = false;
  private static currentProjectFilesHash: string | null = null;
  private static currentProjectId: string | null = null;

  /**
   * Register a callback to be called when internal server errors are detected
   * @param callback Function to call with error message
   */
  static setErrorCallback(callback: ((error: string) => void) | null): void {
    SandboxWebContainerManager.setErrorCallback(callback);
  }

  /**
   * Get console logs with optional filtering
   */
  static async getConsoleLogs(options?: {
    limit?: number;
    level?: 'all' | 'error' | 'warn' | 'info';
    since?: number;
  }): Promise<LogEntry[]> {
    return SandboxWebContainerManager.getConsoleLogs(options);
  }

  static async getInstance(): Promise<WebContainer> {
    return SandboxWebContainerManager.getInstance();
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

    const serverUrl = SandboxWebContainerManager.getServerUrl();

    // If already initialized but switching to a different project, replace files
    if (this.isInitialized && serverUrl && isDifferentProject && savedFiles) {
      console.log(`[init] Switching to different project (ID: ${projectId}), replacing files...`);
      try {
        // Replace project files
        await this.replaceProjectFiles(savedFiles);
        this.currentProjectFilesHash = filesHash;
        this.currentProjectId = projectId || null;
        const container = await this.getInstance();
        return { container, url: serverUrl };
      } catch (error) {
        console.warn(`[init] Failed to replace project files, reinitializing:`, error);
        // Fall through to reinitialize if replace fails
        this.isInitialized = false;
        this.currentProjectFilesHash = null;
        this.currentProjectId = null;
      }
    }

    // If already initialized with the same project, return existing instance
    if (this.isInitialized && serverUrl && !isDifferentProject) {
      const container = await this.getInstance();
      return { container, url: serverUrl };
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

    // Use sandbox package to initialize project with files and start dev server
    const result = await SandboxWebContainerManager.initProject({
      files: filesToMount,
      installDeps: true,
      startDevServer: true,
      devServerOptions: {
        command: "npm",
        args: ["run", "dev"],
        timeout: 30000,
        onOutput: (text) => {
          // Studio-specific error detection and logging
          console.log("[vite]", text);

          // Check for dependency errors
          if (text.includes('dependencies are imported but could not be resolved') ||
            text.includes('The following dependencies') ||
            text.includes('Are they installed?')) {
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
          }
        }
      }
    });

    const container = result.container;
    const url = result.url || `http://localhost:5173`;

    console.log(`[init] Project initialized successfully at ${url}`);
    return { container, url };
  }

  /**
   * Write a file to the container
   * Automatically creates parent directories if they don't exist
   */
  static async writeFile(path: string, content: string): Promise<void> {
    return SandboxWebContainerManager.writeFile(path, content);
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
    return SandboxWebContainerManager.installPackage(packages, options);
  }

  /**
   * Read a file from the container
   */
  static async readFile(path: string): Promise<string> {
    return SandboxWebContainerManager.readFile(path);
  }

  /**
   * List directory contents
   */
  static async readdir(path: string): Promise<string[]> {
    return SandboxWebContainerManager.readdir(path);
  }

  /**
   * Remove a file or directory
   */
  static async rm(path: string, options?: { recursive?: boolean }): Promise<void> {
    return SandboxWebContainerManager.rm(path, options);
  }

  /**
   * Replace the scaffold with a saved project state
   * Also installs dependencies from package.json if present
   */
  static async replaceProjectFiles(fileMap: Record<string, string>): Promise<void> {
    return SandboxWebContainerManager.replaceProjectFiles(fileMap);
  }

  /**
   * Extract internal server error details from Vite output
   * Studio-specific error extraction logic
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
   * Studio-specific error extraction logic
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
   * Studio-specific Vite/TypeScript config fixing logic
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
      const serverUrl = SandboxWebContainerManager.getServerUrl();
      if (serverUrl) {
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
