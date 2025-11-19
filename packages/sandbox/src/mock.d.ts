import { SandboxInterface, SandboxOptions, SandboxProcess, SandboxPort } from "./types";
/**
 * Mock sandbox implementation for testing and server-side usage
 * Stores files in memory and simulates command execution
 */
export declare class MockSandbox implements SandboxInterface {
    private files;
    private ports;
    private ready;
    private processCounter;
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
//# sourceMappingURL=mock.d.ts.map