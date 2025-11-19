import { SandboxInterface, SandboxOptions } from "./types";
/**
 * Simple in-memory sandbox manager
 */
export declare class SandboxManager {
    private sandboxes;
    createSandbox(type?: "webcontainer" | "docker" | "mock", options?: SandboxOptions): Promise<SandboxInterface>;
    getSandbox(id: string): Promise<SandboxInterface | null>;
    destroySandbox(id: string): Promise<void>;
    listSandboxes(): Promise<string[]>;
}
//# sourceMappingURL=manager.d.ts.map