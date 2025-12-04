"use client";

import { FileCode, Loader2 } from "lucide-react";
import type { AIMessage } from "@/lib/ai";
import { AssistantMessageContent } from "./assistant-message-content";
import { MdapProgress, type MdapProgressUpdate } from "../../mdap-progress";

interface ChatMessagesProps {
    messages: AIMessage[];
    isLoading: boolean;
    isMdapExecuting: boolean;
    mdapProgress: MdapProgressUpdate | null;
    isInitializing: boolean;
    scrollRef?: React.RefObject<HTMLDivElement>;
}

export function ChatMessages({
    messages,
    isLoading,
    isMdapExecuting,
    mdapProgress,
    isInitializing,
    scrollRef,
}: ChatMessagesProps) {
    return (
        <div ref={scrollRef} className="flex-1 space-y-2 overflow-y-auto px-4 py-3">
            {isInitializing && (
                <div className="flex items-center gap-2 rounded border border-border bg-card px-3 py-2 text-xs text-card-foreground">
                    <Loader2 className="h-3 w-3 animate-spin text-primary" />
                    <span>Provisioning WebContainer…</span>
                </div>
            )}

            {messages.map((msg, idx) => {
                const hasContent = msg.content.trim().length > 0;
                const hasOperations = msg.operations && msg.operations.length > 0;
                const hasToolCalls = msg.toolCalls && msg.toolCalls.length > 0;
                const hasScreenshot = !!msg.screenshot;
                
                if (msg.role === "assistant" && !hasContent && !hasOperations && !hasToolCalls && !hasScreenshot) {
                    return null;
                }
                return (
                    <div
                        key={`${msg.role}-${idx}`}
                        className={`rounded px-3 py-2 text-xs leading-relaxed ${msg.role === "user"
                            ? "bg-primary text-primary-foreground"
                            : "bg-card text-card-foreground"
                            }`}
                    >
                        {msg.screenshot && (
                            <div className="mb-1.5 flex items-center gap-1.5 text-[10px] opacity-80">
                                <FileCode className="h-3 w-3" />
                                <span>Context attached</span>
                            </div>
                        )}
                        {msg.role === "assistant" ? (
                            <AssistantMessageContent
                                content={msg.content}
                                operations={msg.operations}
                                toolCalls={msg.toolCalls}
                                toolResults={msg.toolResults}
                                isAnimating={(isLoading || isMdapExecuting) && idx === messages.length - 1}
                            />
                        ) : (
                            <p className="whitespace-pre-wrap">{msg.content}</p>
                        )}
                    </div>
                );
            })}

            {/* Show MDAP progress during execution and after completion */}
            {mdapProgress && (
                <MdapProgress progress={mdapProgress} />
            )}

            {isLoading && !isMdapExecuting && !mdapProgress && (
                <div className="flex items-center gap-2 rounded border border-border bg-card px-3 py-2 text-xs text-card-foreground">
                    <Loader2 className="h-3 w-3 animate-spin text-primary" />
                    <span>AI is working…</span>
                </div>
            )}
        </div>
    );
}

