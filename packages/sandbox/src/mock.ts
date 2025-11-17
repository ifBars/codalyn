import { SandboxInterface, SandboxOptions, SandboxProcess, SandboxPort } from "./types";

/**
 * Mock sandbox implementation for testing and server-side usage
 * Stores files in memory and simulates command execution
 */
export class MockSandbox implements SandboxInterface {
  private files: Map<string, string> = new Map();
  private ports: Map<number, SandboxPort> = new Map();
  private ready = false;
  private processCounter = 0;

  async init(options?: SandboxOptions): Promise<void> {
    if (options?.files) {
      for (const [path, content] of Object.entries(options.files)) {
        this.files.set(path, content);
      }
    }

    // Initialize with some default structure
    this.files.set("package.json", JSON.stringify({
      name: "codalyn-project",
      version: "0.1.0",
      scripts: {
        dev: "next dev",
        build: "next build",
        start: "next start"
      }
    }, null, 2));

    this.ready = true;
  }

  async readFile(path: string): Promise<string> {
    if (!this.ready) throw new Error("Sandbox not initialized");

    // Normalize path
    const normalizedPath = path.startsWith("./") ? path.slice(2) : path;

    const content = this.files.get(normalizedPath);
    if (content === undefined) {
      throw new Error(`File not found: ${path}`);
    }
    return content;
  }

  async writeFile(path: string, content: string): Promise<void> {
    if (!this.ready) throw new Error("Sandbox not initialized");

    // Normalize path
    const normalizedPath = path.startsWith("./") ? path.slice(2) : path;

    // Create parent directories if needed (simulated)
    const parts = normalizedPath.split("/");
    if (parts.length > 1) {
      for (let i = 1; i < parts.length; i++) {
        const dirPath = parts.slice(0, i).join("/");
        if (!this.files.has(dirPath)) {
          this.files.set(dirPath, "__DIR__");
        }
      }
    }

    this.files.set(normalizedPath, content);
  }

  async readdir(path: string): Promise<string[]> {
    if (!this.ready) throw new Error("Sandbox not initialized");

    // Normalize path
    const normalizedPath = path === "." ? "" : (path.startsWith("./") ? path.slice(2) : path);
    const prefix = normalizedPath ? `${normalizedPath}/` : "";

    const entries = new Set<string>();
    for (const filePath of this.files.keys()) {
      if (filePath.startsWith(prefix) && filePath !== normalizedPath) {
        const relativePath = filePath.slice(prefix.length);
        const nextSlash = relativePath.indexOf("/");
        if (nextSlash === -1) {
          entries.add(relativePath);
        } else {
          entries.add(relativePath.slice(0, nextSlash));
        }
      }
    }

    return Array.from(entries);
  }

  async deletePath(path: string, options?: { recursive?: boolean }): Promise<void> {
    if (!this.ready) throw new Error("Sandbox not initialized");

    const normalizedPath = path.startsWith("./") ? path.slice(2) : path;

    if (options?.recursive) {
      // Delete all files starting with this path
      const toDelete: string[] = [];
      for (const filePath of this.files.keys()) {
        if (filePath === normalizedPath || filePath.startsWith(`${normalizedPath}/`)) {
          toDelete.push(filePath);
        }
      }
      for (const filePath of toDelete) {
        this.files.delete(filePath);
      }
    } else {
      this.files.delete(normalizedPath);
    }
  }

  async mkdir(path: string, options?: { recursive?: boolean }): Promise<void> {
    if (!this.ready) throw new Error("Sandbox not initialized");

    const normalizedPath = path.startsWith("./") ? path.slice(2) : path;
    this.files.set(normalizedPath, "__DIR__");
  }

  async glob(pattern: string): Promise<string[]> {
    if (!this.ready) throw new Error("Sandbox not initialized");

    const allFiles = Array.from(this.files.keys()).filter(
      (path) => this.files.get(path) !== "__DIR__"
    );

    // Simple glob matching
    if (pattern.includes("*")) {
      const regex = new RegExp("^" + pattern.replace(/\*/g, ".*").replace(/\?/g, ".") + "$");
      return allFiles.filter((f) => regex.test(f));
    }

    return allFiles.filter((f) => f.includes(pattern));
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
    if (!this.ready) throw new Error("Sandbox not initialized");

    const processId = (this.processCounter++).toString();

    // Simulate command execution with mock output
    let mockOutput = "";

    if (command.includes("npm install") || command.includes("bun install")) {
      mockOutput = "✓ Dependencies installed successfully\n";
    } else if (command.includes("npm run") || command.includes("bun run")) {
      mockOutput = "✓ Command executed successfully\n";
    } else if (command.includes("git")) {
      mockOutput = "✓ Git command executed\n";
    } else {
      mockOutput = `✓ Executed: ${command}\n`;
    }

    // Create a readable stream with the mock output
    const stream = new ReadableStream<string>({
      start(controller) {
        controller.enqueue(mockOutput);
        controller.close();
      },
    });

    return {
      id: processId,
      kill: async () => {
        // No-op for mock
      },
      output: stream,
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
      type: "docker", // Use "docker" as the type for server-side mock
      ready: this.ready,
    };
  }

  async destroy(): Promise<void> {
    this.files.clear();
    this.ports.clear();
    this.ready = false;
  }
}
