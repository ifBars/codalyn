"use client";

import { Brain, ListChecks } from "lucide-react";
import { MarkdownContent } from "@/components/ui/markdown-content";
import { parseChatContent } from "@/lib/chat-parser";
import type { FileOperation, ToolCall, ToolResult } from "@/lib/ai";
import { CollapsibleSection } from "./collapsible-section";
import { ToolCallsList } from "./tool-calls-list";

interface AssistantMessageContentProps {
    content: string;
    operations?: FileOperation[];
    toolCalls?: ToolCall[];
    toolResults?: ToolResult[];
    isAnimating?: boolean;
}

export function AssistantMessageContent({ 
    content, 
    operations, 
    toolCalls, 
    toolResults, 
    isAnimating = false 
}: AssistantMessageContentProps) {
    const sections = parseChatContent(content, isAnimating);

    // Filter out empty sections to prevent extra spacing
    const validSections = sections.filter(s => s.content.trim().length > 0);

    const hasContent = validSections.length > 0;
    const hasOperations = operations && operations.length > 0;
    const hasToolCalls = toolCalls && toolCalls.length > 0;

    if (!hasContent && !hasOperations && !hasToolCalls) {
        return null;
    }

    return (
        <div className="space-y-2">
            {hasToolCalls && (
                <ToolCallsList toolCalls={toolCalls} toolResults={toolResults} />
            )}
            {validSections.map((section, idx) => {
                if (section.type === 'thinking') {
                    return (
                        <CollapsibleSection key={idx} title="Thinking Process" icon={Brain} defaultOpen={false}>
                            <div className="whitespace-pre-wrap text-muted-foreground">{section.content}</div>
                        </CollapsibleSection>
                    );
                } else if (section.type === 'plan') {
                    return (
                        <CollapsibleSection key={idx} title="Plan" icon={ListChecks} defaultOpen={true}>
                            <div className="whitespace-pre-wrap">{section.content}</div>
                        </CollapsibleSection>
                    );
                } else {
                    return (
                        <MarkdownContent
                            key={idx}
                            content={section.content}
                            operations={operations}
                            isAnimating={isAnimating && idx === validSections.length - 1}
                        />
                    );
                }
            })}
        </div>
    );
}

