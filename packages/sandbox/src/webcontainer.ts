import { SandboxInterface, SandboxOptions, SandboxProcess, SandboxPort } from "./types";
import { WebContainer } from "@webcontainer/api";

/**
 * WebContainer sandbox implementation
 */
export class WebContainerSandbox implements SandboxInterface {
  private webcontainer: WebContainer | null = null;
  private ports: Map<number, SandboxPort> = new Map();

  async init(options?: SandboxOptions): Promise<void> {
    const { WebContainer } = await import("@webcontainer/api");
    this.webcontainer = await WebContainer.boot();
    
    if (options?.files) {
      await this.webcontainer.mount(options.files);
    }
  }

  async readFile(path: string): Promise<string> {
    if (!this.webcontainer) throw new Error("Sandbox not initialized");
    const file = await this.webcontainer.fs.readFile(path, "utf-8");
    return file as string;
  }

  async writeFile(path: string, content: string): Promise<void> {
    if (!this.webcontainer) throw new Error("Sandbox not initialized");
    await this.webcontainer.fs.writeFile(path, content);
  }

  async readdir(path: string): Promise<string[]> {
    if (!this.webcontainer) throw new Error("Sandbox not initialized");
    const entries = await this.webcontainer.fs.readdir(path, { withFileTypes: true });
    return entries.map((e) => e.name);
  }

  async deletePath(path: string, options?: { recursive?: boolean }): Promise<void> {
    if (!this.webcontainer) throw new Error("Sandbox not initialized");
    await this.webcontainer.fs.rm(path, { recursive: options?.recursive ?? false });
  }

  async mkdir(path: string, options?: { recursive?: boolean }): Promise<void> {
    if (!this.webcontainer) throw new Error("Sandbox not initialized");
    await this.webcontainer.fs.mkdir(path, { recursive: options?.recursive ?? false });
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
    }
  ): Promise<SandboxProcess> {
    if (!this.webcontainer) throw new Error("Sandbox not initialized");
    
    const process = await this.webcontainer.spawn("sh", ["-c", command], {
      cwd: options?.cwd,
      env: options?.env,
    });

    return {
      id: process.pid.toString(),
      kill: async () => {
        await process.kill();
      },
      output: process.output,
    };
  }

  async getPorts(): Promise<SandboxPort[]> {
    return Array.from(this.ports.values());
  }

  async openPort(port: number, protocol: "http" | "https" = "http"): Promise<void> {
    this.ports.set(port, { port, protocol });
  }

  async getInfo(): Promise<{ type: "webcontainer" | "docker"; ready: boolean }> {
    return {
      type: "webcontainer",
      ready: this.webcontainer !== null,
    };
  }

  async destroy(): Promise<void> {
    // WebContainer cleanup handled by browser
    this.webcontainer = null;
    this.ports.clear();
  }
}

