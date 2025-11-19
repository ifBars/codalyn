import { SandboxInterface, SandboxOptions, SandboxProcess, SandboxPort } from "./types";
/**
 * WebContainer sandbox implementation
 */
export declare class WebContainerSandbox implements SandboxInterface {
    private webcontainer;
    private ports;
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
//# sourceMappingURL=webcontainer.d.ts.map