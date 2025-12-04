"use client";

import { FileText } from "lucide-react";
import { cn } from "@/lib/utils";
import type { Artifact } from "@codalyn/accuralai";

interface ChatHeaderProps {
    plans: Artifact[];
    showPlans: boolean;
    onTogglePlans: () => void;
    onNewChat: () => void;
}

export function ChatHeader({ plans, showPlans, onTogglePlans, onNewChat }: ChatHeaderProps) {
    return (
        <div className="flex items-center justify-between border-b border-border px-4 py-2 text-[10px] uppercase tracking-wider text-muted-foreground">
            <span>Chat</span>
            <div className="flex items-center gap-2">
                {plans.length > 0 && (
                    <button
                        type="button"
                        onClick={onTogglePlans}
                        className={cn(
                            "relative rounded border px-2 py-1 text-[11px] font-medium transition",
                            showPlans
                                ? "border-primary bg-primary/10 text-primary"
                                : "border-border text-foreground hover:border-primary hover:text-primary"
                        )}
                    >
                        <div className="flex items-center gap-1.5">
                            <FileText className="h-3 w-3" />
                            <span>Plans</span>
                            <span className="rounded-full bg-primary/20 px-1.5 py-0.5 text-[10px] text-primary">
                                {plans.length}
                            </span>
                        </div>
                    </button>
                )}
                <button
                    type="button"
                    onClick={onNewChat}
                    className="rounded border border-border px-2 py-1 text-[11px] font-medium text-foreground transition hover:border-primary hover:text-primary"
                >
                    New chat
                </button>
            </div>
        </div>
    );
}

