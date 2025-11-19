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
        const seenNames = new Set<string>();
        
        for (const toolSet of this.toolSets) {
            for (const def of toolSet.getDefinitions()) {
                // Deduplicate by name - later tool sets override earlier ones
                if (!seenNames.has(def.name)) {
                    allDefinitions.push(def);
                    seenNames.add(def.name);
                } else {
                    // Replace existing definition with the new one (later tool sets take precedence)
                    const index = allDefinitions.findIndex(d => d.name === def.name);
                    if (index !== -1) {
                        allDefinitions[index] = def;
                    }
                }
            }
        }
        return allDefinitions;
    }

    async execute(toolCall: ToolCall, context?: any): Promise<ToolResult> {
        console.log(`[AI Debug] CompositeToolSet.execute() - Tool: ${toolCall.name}`);
        console.log(`[AI Debug] Checking ${this.toolSets.length} tool sets`);

        // Find the tool set that has this tool
        for (let i = 0; i < this.toolSets.length; i++) {
            const toolSet = this.toolSets[i];
            if (toolSet.hasTool(toolCall.name)) {
                console.log(`[AI Debug] Found tool ${toolCall.name} in tool set ${i}`);
                return toolSet.execute(toolCall, context);
            }
        }

        // Tool not found in any set
        console.error(`[AI Debug] Tool ${toolCall.name} not found in any tool set`);
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
