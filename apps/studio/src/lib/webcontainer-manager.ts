"use client";

import { WebContainer } from "@webcontainer/api";
import {
  projectTemplateTree,
  templateRootFiles,
} from "./project-template";

/**
 * WebContainer Manager for running Vite + React + Tailwind projects in-browser
 */
export class WebContainerManager {
  private static instance: WebContainer | null = null;
  private static bootPromise: Promise<WebContainer> | null = null;

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
   */
  static async initProject(): Promise<{
    container: WebContainer;
    url: string;
  }> {
    const container = await this.getInstance();

    // Mount the project files
    await container.mount(projectTemplateTree);

    // Install dependencies
    console.log("Installing dependencies...");
    const installProcess = await container.spawn("npm", ["install"]);

    // Wait for install to complete
    const installExitCode = await installProcess.exit;
    if (installExitCode !== 0) {
      throw new Error("Failed to install dependencies");
    }

    console.log("Starting dev server...");

    // Wait for server to be ready (set up listener first)
    const serverReadyPromise = new Promise<string>((resolve) => {
      container.on("server-ready", (port, url) => {
        console.log(`Server ready on port ${port} at ${url}`);
        resolve(url);
      });
    });

    // Start dev server
    const devProcess = await container.spawn("npm", ["run", "dev"]);

    // Log output
    devProcess.output.pipeTo(
      new WritableStream({
        write(data) {
          console.log("[vite]", data);
        },
      })
    );

    // Wait for the server URL
    const url = await serverReadyPromise;

    return { container, url };
  }

  /**
   * Write a file to the container
   * Automatically creates parent directories if they don't exist
   */
  static async writeFile(path: string, content: string): Promise<void> {
    const container = await this.getInstance();

    // Extract directory path and create it if needed
    const dirPath = path.split('/').slice(0, -1).join('/');
    if (dirPath) {
      try {
        await container.fs.mkdir(dirPath, { recursive: true });
      } catch (e) {
        // Directory might already exist, ignore error
      }
    }

    await container.fs.writeFile(path, content);
  }

  /**
   * Install npm packages
   */
  static async installPackage(packages: string[]): Promise<void> {
    const container = await this.getInstance();

    console.log(`[install] Installing packages: ${packages.join(', ')}`);

    const installProcess = await container.spawn("npm", [
      "install",
      ...packages,
    ]);

    installProcess.output.pipeTo(
      new WritableStream({
        write(data) {
          console.log("[npm install]", data);
        },
      })
    );

    const exitCode = await installProcess.exit;
    if (exitCode !== 0) {
      throw new Error(`Package installation failed with exit code ${exitCode}`);
    }

    console.log(`[install] Successfully installed: ${packages.join(', ')}`);
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
  }
}
