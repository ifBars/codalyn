/**
 * Bridge between the new Agent system and the existing @codalyn/tools package
 */

import { ToolSet, ToolDefinition, ToolCall, ToolResult } from "../core/types";
import { toolRegistry, getExecutor } from "@codalyn/tools";
import { SandboxInterface } from "@codalyn/sandbox";

export class CodalynToolSet implements ToolSet {
    private sandbox: SandboxInterface;

    constructor(sandbox: SandboxInterface) {
        this.sandbox = sandbox;
    }

    getDefinitions(): ToolDefinition[] {
        // Filter out tools that are handled by other tool sets:
        // - search_project: handled by VectorStoreToolSet
        // - context7_get_docs, context7_resolve_library: handled by Context7ToolSet
        return toolRegistry
            .filter((tool) => 
                tool.name !== "search_project" &&
                tool.name !== "context7_get_docs" &&
                tool.name !== "context7_resolve_library"
            )
            .map((tool) => ({
                name: tool.name,
                description: tool.description,
                parameters: tool.parameters,
            }));
    }

    async execute(toolCall: ToolCall, context?: any): Promise<ToolResult> {
        console.log(`[AI Debug] CodalynToolSet.execute() - Tool: ${toolCall.name}`);
        console.log(`[AI Debug] Tool args:`, toolCall.args);

        const executor = getExecutor(toolCall.name);

        if (!executor) {
            console.error(`[AI Debug] Tool executor not found: ${toolCall.name}`);
            return {
                toolCallId: toolCall.id,
                name: toolCall.name,
                result: null,
                error: `Tool executor not found: ${toolCall.name}`,
                success: false,
            };
        }

        try {
            console.log(`[AI Debug] Executing tool ${toolCall.name}...`);
            const execStartTime = Date.now();
            const result = await executor.execute(toolCall.args, this.sandbox);
            const execDuration = Date.now() - execStartTime;
            // Safely create output preview
            let outputPreview = "N/A";
            try {
                if (result.output === undefined || result.output === null) {
                    outputPreview = String(result.output);
                } else if (typeof result.output === 'string') {
                    outputPreview = result.output.substring(0, 100) + (result.output.length > 100 ? "..." : "");
                } else {
                    const stringified = JSON.stringify(result.output);
                    outputPreview = stringified ? stringified.substring(0, 100) + (stringified.length > 100 ? "..." : "") : "Unable to stringify";
                }
            } catch (e) {
                outputPreview = `[Error stringifying output: ${e instanceof Error ? e.message : String(e)}]`;
            }

            console.log(`[AI Debug] Tool ${toolCall.name} executor completed (${execDuration}ms)`, {
                success: result.success,
                error: result.error,
                outputPreview
            });

            return {
                toolCallId: toolCall.id,
                name: toolCall.name,
                result: result.output,
                error: result.error,
                success: result.success,
            };
        } catch (error) {
            console.error(`[AI Debug] Tool ${toolCall.name} threw exception:`, error);
            return {
                toolCallId: toolCall.id,
                name: toolCall.name,
                result: null,
                error: error instanceof Error ? error.message : "Unknown error",
                success: false,
            };
        }
    }

    hasTool(name: string): boolean {
        // Exclude tools handled by other tool sets:
        // - search_project: handled by VectorStoreToolSet
        // - context7_get_docs, context7_resolve_library: handled by Context7ToolSet
        if (name === "search_project" || name === "context7_get_docs" || name === "context7_resolve_library") {
            return false;
        }
        return getExecutor(name) !== undefined;
    }

    /**
     * Update the sandbox instance
     */
    setSandbox(sandbox: SandboxInterface): void {
        this.sandbox = sandbox;
    }
}
