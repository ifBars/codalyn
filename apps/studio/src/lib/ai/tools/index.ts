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
        return toolRegistry.map((tool) => ({
            name: tool.name,
            description: tool.description,
            parameters: tool.parameters,
        }));
    }

    async execute(toolCall: ToolCall, context?: any): Promise<ToolResult> {
        const executor = getExecutor(toolCall.name);

        if (!executor) {
            return {
                toolCallId: toolCall.id,
                name: toolCall.name,
                result: null,
                error: `Tool executor not found: ${toolCall.name}`,
                success: false,
            };
        }

        try {
            const result = await executor.execute(toolCall.args, this.sandbox);

            return {
                toolCallId: toolCall.id,
                name: toolCall.name,
                result: result.output,
                error: result.error,
                success: result.success,
            };
        } catch (error) {
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
        return getExecutor(name) !== undefined;
    }

    /**
     * Update the sandbox instance
     */
    setSandbox(sandbox: SandboxInterface): void {
        this.sandbox = sandbox;
    }
}
