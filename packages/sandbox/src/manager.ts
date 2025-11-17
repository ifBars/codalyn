import { SandboxInterface, SandboxOptions } from "./types";

/**
 * Simple in-memory sandbox manager
 */
export class SandboxManager {
  private sandboxes: Map<string, SandboxInterface> = new Map();

  async createSandbox(
    type: "webcontainer" | "docker" | "mock" = "mock",
    options?: SandboxOptions
  ): Promise<SandboxInterface> {
    // Import dynamically to avoid circular dependencies
    if (type === "webcontainer") {
      const { WebContainerSandbox } = await import("./webcontainer");
      const sandbox = new WebContainerSandbox();
      await sandbox.init(options);
      const id = crypto.randomUUID();
      this.sandboxes.set(id, sandbox);
      return sandbox;
    } else if (type === "docker") {
      const { DockerSandbox } = await import("./docker");
      const sandbox = new DockerSandbox();
      await sandbox.init(options);
      const id = crypto.randomUUID();
      this.sandboxes.set(id, sandbox);
      return sandbox;
    } else {
      // Use mock sandbox by default (works server-side)
      const { MockSandbox } = await import("./mock");
      const sandbox = new MockSandbox();
      await sandbox.init(options);
      const id = crypto.randomUUID();
      this.sandboxes.set(id, sandbox);
      return sandbox;
    }
  }

  async getSandbox(id: string): Promise<SandboxInterface | null> {
    return this.sandboxes.get(id) || null;
  }

  async destroySandbox(id: string): Promise<void> {
    const sandbox = this.sandboxes.get(id);
    if (sandbox) {
      await sandbox.destroy();
      this.sandboxes.delete(id);
    }
  }

  async listSandboxes(): Promise<string[]> {
    return Array.from(this.sandboxes.keys());
  }
}

