/**
 * WebContainer implementation of SandboxInterface
 * Bridges the new Agent system with WebContainerManager
 */

import { SandboxInterface, SandboxProcess } from "@codalyn/sandbox";
import { WebContainerManager } from "../../webcontainer-manager";

export class WebContainerSandbox implements SandboxInterface {
    async readFile(path: string): Promise<string> {
        return WebContainerManager.readFile(path);
    }

    async writeFile(path: string, content: string): Promise<void> {
        return WebContainerManager.writeFile(path, content);
    }

    async readdir(path: string): Promise<string[]> {
        return WebContainerManager.readdir(path);
    }

    async deletePath(path: string, options?: { recursive?: boolean }): Promise<void> {
        return WebContainerManager.rm(path, options);
    }

    async mkdir(path: string, options?: { recursive?: boolean }): Promise<void> {
        const container = await WebContainerManager.getInstance();
        if (options?.recursive) {
            await container.fs.mkdir(path, { recursive: true });
        } else {
            await container.fs.mkdir(path);
        }
    }

    async glob(pattern: string): Promise<string[]> {
        // Simple glob implementation - can be enhanced later
        // For now, just list all files recursively and filter
        const allFiles = await this.listAllFiles(".");
        const regex = this.globToRegex(pattern);
        return allFiles.filter(file => regex.test(file));
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
        const container = await WebContainerManager.getInstance();

        // Parse command into program and args
        const parts = command.split(" ");
        const program = parts[0];
        const args = parts.slice(1);

        const process = await container.spawn(program, args, {
            cwd: options?.cwd,
            env: options?.env,
        });

        // Convert WebContainer output to ReadableStream<string>
        const outputStream = new ReadableStream<string>({
            async start(controller) {
                try {
                    const reader = process.output.getReader();
                    while (true) {
                        const { done, value } = await reader.read();
                        if (done) break;

                        // Convert Uint8Array to string if needed
                        const text = typeof value === "string"
                            ? value
                            : new TextDecoder().decode(value);
                        controller.enqueue(text);
                    }
                    controller.close();
                } catch (error) {
                    controller.error(error);
                }
            },
        });

        return {
            id: `wc-${Date.now()}`,
            output: outputStream,
            async kill() {
                process.kill();
            },
        };
    }

    async getPorts(): Promise<Array<{ port: number; protocol: "http" | "https" }>> {
        // WebContainer doesn't expose port info directly
        // Return empty array for now
        return [];
    }

    async openPort(port: number, protocol?: "http" | "https"): Promise<void> {
        // WebContainer handles ports automatically
        // No-op for now
    }

    async init(options?: { files?: Record<string, string>; environment?: Record<string, string> }): Promise<void> {
        // WebContainer is initialized via WebContainerManager.initProject
        // This is a no-op since initialization happens elsewhere
    }

    async destroy(): Promise<void> {
        // WebContainer instance is managed globally
        // No-op for now
    }

    async getInfo(): Promise<{ type: "webcontainer" | "docker"; ready: boolean }> {
        return {
            type: "webcontainer",
            ready: true,
        };
    }

    async installPackage(packages: string[], options?: { dev?: boolean }): Promise<{ success: boolean; output?: string; error?: string }> {
        try {
            console.log(`[AI Debug] WebContainerSandbox.installPackage() - Installing: ${packages.join(', ')} (dev: ${options?.dev ?? false})`);
            const packageJson = await WebContainerManager.installPackage(packages, { dev: options?.dev ?? false });
            
            if (packageJson) {
                return {
                    success: true,
                    output: `Successfully installed packages: ${packages.join(', ')}`,
                };
            } else {
                return {
                    success: false,
                    error: "Package installation completed but package.json could not be read",
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

    // Helper methods
    private async listAllFiles(dir: string, prefix: string = ""): Promise<string[]> {
        const files: string[] = [];
        try {
            const entries = await this.readdir(dir);
            for (const entry of entries) {
                const fullPath = prefix ? `${prefix}/${entry}` : entry;
                const entryPath = dir === "." ? entry : `${dir}/${entry}`;

                try {
                    // Try to read as directory
                    await this.readdir(entryPath);
                    // It's a directory, recurse
                    const subFiles = await this.listAllFiles(entryPath, fullPath);
                    files.push(...subFiles);
                } catch {
                    // It's a file
                    files.push(fullPath);
                }
            }
        } catch (error) {
            // Directory doesn't exist or can't be read
        }
        return files;
    }

    private globToRegex(pattern: string): RegExp {
        // Simple glob to regex conversion
        // Supports * and **
        let regexPattern = pattern
            .replace(/\./g, "\\.")
            .replace(/\*\*/g, "___DOUBLE_STAR___")
            .replace(/\*/g, "[^/]*")
            .replace(/___DOUBLE_STAR___/g, ".*");

        return new RegExp(`^${regexPattern}$`);
    }
}
