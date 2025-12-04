"use client";

import { useMemo } from "react";
import type { ToolCall, ToolResult } from "@/lib/ai";
import { CollapsibleSection } from "./collapsible-section";
import {
    FileText,
    GitBranch,
    Package,
    Search,
    Database,
    Camera,
    BookOpen,
    Box,
    Wrench,
} from "lucide-react";

interface ToolCallsListProps {
    toolCalls?: ToolCall[];
    toolResults?: ToolResult[];
}

type ToolCategory = 
    | "filesystem"
    | "git"
    | "package"
    | "search"
    | "sandbox"
    | "database"
    | "browser"
    | "context7"
    | "other";

interface CategorizedTool {
    toolCall: ToolCall;
    toolResult?: ToolResult;
    category: ToolCategory;
}

/**
 * Categorize a tool by its name
 */
function getToolCategory(toolName: string): ToolCategory {
    const name = toolName.toLowerCase();
    
    // Filesystem tools
    if (
        name.includes("read_file") ||
        name.includes("write_file") ||
        name.includes("list_directory") ||
        name.includes("delete_path") ||
        name.includes("delete_file") ||
        name.includes("delete") ||
        name.includes("glob_search") ||
        name.includes("find_in_files") ||
        name.includes("apply_patch") ||
        name.includes("replace_in_file") ||
        name.includes("rename_path") ||
        name.includes("copy_path") ||
        name.includes("get_file_info") ||
        name.includes("create_directory") ||
        name.includes("insert_at_line") ||
        name.includes("append_to_file") ||
        name.includes("read_lines")
    ) {
        return "filesystem";
    }
    
    // Git tools
    if (name.startsWith("git_")) {
        return "git";
    }
    
    // Package management
    if (name.includes("npm_install") || name.includes("npm_uninstall") || name.includes("npminstall")) {
        return "package";
    }
    
    // Search
    if (name.includes("search_project")) {
        return "search";
    }
    
    // Sandbox
    if (name.includes("sandbox_info") || name.includes("port_list") || name.includes("open_port")) {
        return "sandbox";
    }
    
    // Database
    if (name.includes("db_query")) {
        return "database";
    }
    
    // Browser
    if (name.includes("capture_screenshot")) {
        return "browser";
    }
    
    // Context7
    if (name.includes("context7")) {
        return "context7";
    }
    
    return "other";
}

/**
 * Get icon for a tool category
 */
function getCategoryIcon(category: ToolCategory) {
    switch (category) {
        case "filesystem":
            return FileText;
        case "git":
            return GitBranch;
        case "package":
            return Package;
        case "search":
            return Search;
        case "sandbox":
            return Box;
        case "database":
            return Database;
        case "browser":
            return Camera;
        case "context7":
            return BookOpen;
        default:
            return Wrench;
    }
}

/**
 * Get display name for a tool category
 */
function getCategoryName(category: ToolCategory): string {
    switch (category) {
        case "filesystem":
            return "Filesystem";
        case "git":
            return "Git";
        case "package":
            return "Package Management";
        case "search":
            return "Search";
        case "sandbox":
            return "Sandbox";
        case "database":
            return "Database";
        case "browser":
            return "Browser";
        case "context7":
            return "Documentation";
        default:
            return "Other";
    }
}

/**
 * Format tool arguments for display
 */
function formatToolArgs(args: Record<string, any>): string {
    const entries = Object.entries(args);
    if (entries.length === 0) return "No arguments";
    
    const formatted = entries
        .slice(0, 3) // Show first 3 args
        .map(([key, value]) => {
            let displayValue: string;
            if (value === null || value === undefined) {
                displayValue = "null";
            } else if (typeof value === "string") {
                displayValue = value.length > 30 ? value.substring(0, 30) + "..." : value;
            } else if (Array.isArray(value)) {
                displayValue = `[${value.length} items]`;
            } else if (typeof value === "object") {
                displayValue = "{...}";
            } else {
                displayValue = String(value);
            }
            return `${key}: ${displayValue}`;
        });
    
    if (entries.length > 3) {
        formatted.push(`+${entries.length - 3} more`);
    }
    
    return formatted.join(", ");
}

/**
 * Match tool calls with their results
 */
function matchToolCallsWithResults(
    toolCalls: ToolCall[],
    toolResults: ToolResult[]
): Map<ToolCall, ToolResult | undefined> {
    const matches = new Map<ToolCall, ToolResult | undefined>();
    
    for (const toolCall of toolCalls) {
        // Try to match by toolCallId first
        let matched = toolResults.find(
            (tr) => tr.toolCallId && toolCall.id && tr.toolCallId === toolCall.id
        );
        
        // If no match by ID, try matching by name and position
        if (!matched) {
            const callIndex = toolCalls.indexOf(toolCall);
            if (callIndex < toolResults.length && toolResults[callIndex].name === toolCall.name) {
                matched = toolResults[callIndex];
            }
        }
        
        matches.set(toolCall, matched);
    }
    
    return matches;
}

export function ToolCallsList({ toolCalls = [], toolResults = [] }: ToolCallsListProps) {
    const categorizedTools = useMemo(() => {
        if (toolCalls.length === 0) return [];
        
        const matches = matchToolCallsWithResults(toolCalls, toolResults);
        const categorized: CategorizedTool[] = [];
        
        for (const toolCall of toolCalls) {
            const category = getToolCategory(toolCall.name);
            const toolResult = matches.get(toolCall);
            
            categorized.push({
                toolCall,
                toolResult,
                category,
            });
        }
        
        return categorized;
    }, [toolCalls, toolResults]);
    
    // Group by category
    const groupedByCategory = useMemo(() => {
        const groups = new Map<ToolCategory, CategorizedTool[]>();
        
        for (const tool of categorizedTools) {
            const existing = groups.get(tool.category) || [];
            existing.push(tool);
            groups.set(tool.category, existing);
        }
        
        return groups;
    }, [categorizedTools]);
    
    if (toolCalls.length === 0) {
        return null;
    }
    
    // Create a single collapsible section containing all tool calls, grouped by category
    const categoryEntries = Array.from(groupedByCategory.entries());
    
    return (
        <CollapsibleSection
            title={`Tool Calls (${toolCalls.length})`}
            icon={Wrench}
            defaultOpen={false}
        >
            <div className="space-y-3">
                {categoryEntries.map(([category, tools]) => {
                    const Icon = getCategoryIcon(category);
                    const categoryName = getCategoryName(category);
                    
                    return (
                        <div key={category} className="space-y-2">
                            {categoryEntries.length > 1 && (
                                <div className="flex items-center gap-2 pb-1 border-b border-border/30">
                                    <Icon className="h-3 w-3 text-muted-foreground" />
                                    <span className="text-[10px] font-medium text-muted-foreground uppercase tracking-wide">
                                        {categoryName} ({tools.length})
                                    </span>
                                </div>
                            )}
                            <div className="space-y-2">
                                {tools.map(({ toolCall, toolResult }, idx) => {
                                    const success = toolResult ? toolResult.success : undefined;
                                    const hasError = toolResult?.error;
                                    
                                    return (
                                        <div
                                            key={`${toolCall.name}-${idx}`}
                                            className="rounded border border-border/30 bg-muted/10 p-2"
                                        >
                                            <div className="flex items-start justify-between gap-2">
                                                <div className="flex-1 min-w-0">
                                                    <div className="flex items-center gap-2">
                                                        <span className="font-medium text-xs text-foreground">
                                                            {toolCall.name}
                                                        </span>
                                                        {success !== undefined && (
                                                            <span
                                                                className={`text-[10px] px-1.5 py-0.5 rounded ${
                                                                    success
                                                                        ? "bg-green-500/20 text-green-600 dark:text-green-400"
                                                                        : "bg-red-500/20 text-red-600 dark:text-red-400"
                                                                }`}
                                                            >
                                                                {success ? "Success" : "Failed"}
                                                            </span>
                                                        )}
                                                    </div>
                                                    <div className="mt-1 text-[10px] text-muted-foreground">
                                                        {formatToolArgs(toolCall.args)}
                                                    </div>
                                                    {hasError && (
                                                        <div className="mt-1 text-[10px] text-red-600 dark:text-red-400">
                                                            Error: {toolResult.error}
                                                        </div>
                                                    )}
                                                </div>
                                            </div>
                                        </div>
                                    );
                                })}
                            </div>
                        </div>
                    );
                })}
            </div>
        </CollapsibleSection>
    );
}

