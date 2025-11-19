import { SandboxInterface, SandboxOptions, SandboxProcess, SandboxPort } from "./types";
/**
 * Docker sandbox implementation
 * This is a placeholder - actual implementation would use Docker API
 */
export declare class DockerSandbox implements SandboxInterface {
    private containerId;
    private ports;
    private ready;
    init(options?: SandboxOptions): Promise<void>;
    readFile(path: string): Promise<string>;
    writeFile(path: string, content: string): Promise<void>;
    readdir(path: string): Promise<string[]>;
    deletePath(path: string, options?: {
        recursive?: boolean;
    }): Promise<void>;
    mkdir(path: string, options?: {
        recursive?: boolean;
    }): Promise<void>;
    glob(pattern: string): Promise<string[]>;
    runCommand(command: string, options?: {
        cwd?: string;
        env?: Record<string, string>;
        timeout?: number;
        background?: boolean;
    }): Promise<SandboxProcess>;
    getPorts(): Promise<SandboxPort[]>;
    openPort(port: number, protocol?: "http" | "https"): Promise<void>;
    getInfo(): Promise<{
        type: "webcontainer" | "docker";
        ready: boolean;
    }>;
    destroy(): Promise<void>;
}
//# sourceMappingURL=docker.d.ts.map