/**
 * Composite ToolSet that combines multiple tool sets
 */

import { ToolSet, ToolDefinition, ToolCall, ToolResult } from "../core/types";

export class CompositeToolSet implements ToolSet {
    private toolSets: ToolSet[];

    constructor(toolSets: ToolSet[]) {
        this.toolSets = toolSets;
    }

    getDefinitions(): ToolDefinition[] {
        const allDefinitions: ToolDefinition[] = [];
        for (const toolSet of this.toolSets) {
            allDefinitions.push(...toolSet.getDefinitions());
        }
        return allDefinitions;
    }

    async execute(toolCall: ToolCall, context?: any): Promise<ToolResult> {
        // Find the tool set that has this tool
        for (const toolSet of this.toolSets) {
            if (toolSet.hasTool(toolCall.name)) {
                return toolSet.execute(toolCall, context);
            }
        }

        // Tool not found in any set
        return {
            toolCallId: toolCall.id,
            name: toolCall.name,
            result: null,
            error: `Tool not found: ${toolCall.name}`,
            success: false,
        };
    }

    hasTool(name: string): boolean {
        return this.toolSets.some(toolSet => toolSet.hasTool(name));
    }

    addToolSet(toolSet: ToolSet): void {
        this.toolSets.push(toolSet);
    }
}
