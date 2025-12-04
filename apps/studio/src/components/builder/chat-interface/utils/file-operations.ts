import type { FileOperation } from "@/lib/ai";
import { WebContainerManager } from "@/lib/webcontainer-manager";
import { applyFileOperationsToProject } from "@/lib/project-storage";
import type { StoredProject } from "@/lib/project-storage";

export interface ApplyFileOperationsParams {
    operations: FileOperation[];
    activeProject: StoredProject;
    setMessages: React.Dispatch<React.SetStateAction<any[]>>;
}

/**
 * Apply file operations to WebContainer and update project storage
 */
export async function applyFileOperations({
    operations,
    activeProject,
    setMessages,
}: ApplyFileOperationsParams): Promise<StoredProject | null> {
    if (operations.length === 0) return null;

    const operationErrors: string[] = [];
    const validOperations = operations;
    let packageJsonUpdated = false;

    for (const op of validOperations) {
        try {
            if (op.type === "install_package" && op.packages) {
                try {
                    const updatedPackageJson = await WebContainerManager.readFile("package.json");
                    if (updatedPackageJson) {
                        packageJsonUpdated = true;
                        validOperations.push({
                            type: "write",
                            path: "package.json",
                            content: updatedPackageJson,
                        });
                    }
                } catch (readError) {
                    console.warn(`Could not read package.json after installation:`, readError);
                }
                continue;
            } else if (op.type === "write" && op.content && op.path) {
                await WebContainerManager.writeFile(op.path, op.content);
            } else if (op.type === "delete" && op.path) {
                await WebContainerManager.rm(op.path);
            }
        } catch (error) {
            const errorMsg = error instanceof Error ? error.message : String(error);
            operationErrors.push(`Failed to ${op.type} ${op.path}: ${errorMsg}`);
        }
    }

    if (operationErrors.length > 0) {
        const errorSummary = `⚠ ${operationErrors.length} operation(s) failed:\n${operationErrors.map(err => `  • ${err}`).join('\n')}`;
        setMessages((prev) => {
            const next = [...prev];
            const lastMsg = next[next.length - 1];
            if (lastMsg) {
                next[next.length - 1] = {
                    ...lastMsg,
                    content: lastMsg.content ? `${lastMsg.content}\n\n${errorSummary}` : errorSummary,
                };
            }
            return next;
        });
    }

    setMessages((prev) => {
        const next = [...prev];
        next[next.length - 1] = { ...next[next.length - 1], operations: validOperations };
        return next;
    });

    const updated = applyFileOperationsToProject(activeProject.id, validOperations);
    return updated || null;
}

