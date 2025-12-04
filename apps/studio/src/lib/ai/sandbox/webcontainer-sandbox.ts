/**
 * WebContainer implementation of SandboxInterface
 * Uses WebContainerSandbox from @codalyn/sandbox package directly
 */

import { SandboxInterface, SandboxProcess, LogEntry, WebContainerSandbox as SandboxWebContainerSandbox, FileWatcher, FileSystemListener } from "@codalyn/sandbox";

export class WebContainerSandbox implements SandboxInterface {
    private sandbox: SandboxWebContainerSandbox;

    constructor() {
        this.sandbox = new SandboxWebContainerSandbox();
    }

    async readFile(path: string): Promise<string> {
        return this.sandbox.readFile(path);
    }

    async writeFile(path: string, content: string): Promise<void> {
        return this.sandbox.writeFile(path, content);
    }

    async readdir(path: string): Promise<string[]> {
        return this.sandbox.readdir(path);
    }

    async deletePath(path: string, options?: { recursive?: boolean }): Promise<void> {
        return this.sandbox.deletePath(path, options);
    }

    async mkdir(path: string, options?: { recursive?: boolean }): Promise<void> {
        return this.sandbox.mkdir(path, options);
    }

    async glob(pattern: string): Promise<string[]> {
        return this.sandbox.glob(pattern);
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
        return this.sandbox.runCommand(command, options);
    }

    watch(path: string, options?: { recursive?: boolean }, listener?: FileSystemListener): FileWatcher {
        return this.sandbox.watch!(path, options, listener);
    }

    async getPorts(): Promise<Array<{ port: number; protocol: "http" | "https" }>> {
        return this.sandbox.getPorts();
    }

    async openPort(port: number, protocol?: "http" | "https"): Promise<void> {
        return this.sandbox.openPort(port, protocol);
    }

    async init(options?: { files?: Record<string, string>; environment?: Record<string, string> }): Promise<void> {
        return this.sandbox.init(options);
    }

    async destroy(): Promise<void> {
        return this.sandbox.destroy();
    }

    async getInfo(): Promise<{ type: "webcontainer" | "docker"; ready: boolean }> {
        return this.sandbox.getInfo();
    }

    async getConsoleLogs(options?: {
        limit?: number;
        level?: 'all' | 'error' | 'warn' | 'info';
        since?: number;
    }): Promise<LogEntry[]> {
        return this.sandbox.getConsoleLogs(options);
    }

    async installPackage(packages: string[], options?: { dev?: boolean }): Promise<{ success: boolean; output?: string; error?: string }> {
        try {
            console.log(`[AI Debug] WebContainerSandbox.installPackage() - Installing: ${packages.join(', ')} (dev: ${options?.dev ?? false})`);
            const result = await this.sandbox.installPackage!(packages, { dev: options?.dev ?? false });
            
            if (result.success) {
                return {
                    success: true,
                    output: result.output || `Successfully installed packages: ${packages.join(', ')}`,
                };
            } else {
                return {
                    success: false,
                    error: result.error || "Package installation failed",
                };
            }
        } catch (error) {
            console.error(`[AI Debug] WebContainerSandbox.installPackage() - Error:`, error);
            return {
                success: false,
                error: error instanceof Error ? error.message : "Unknown error during package installation",
            };
        }
    }
}
