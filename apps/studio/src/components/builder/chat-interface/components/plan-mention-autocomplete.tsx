"use client";

import { useEffect, useRef } from "react";
import { FileText, Clock } from "lucide-react";
import { cn } from "@/lib/utils";
import type { Artifact } from "@codalyn/accuralai";
import { formatPlanDate } from "../hooks/use-plans";

interface PlanMentionAutocompleteProps {
    plans: Artifact[];
    query: string;
    selectedIndex: number;
    onSelect: (plan: Artifact) => void;
    onClose: () => void;
    position: { top: number; left: number } | null;
}

export function PlanMentionAutocomplete({
    plans,
    query,
    selectedIndex,
    onSelect,
    onClose,
    position,
}: PlanMentionAutocompleteProps) {
    const containerRef = useRef<HTMLDivElement>(null);
    const selectedRef = useRef<HTMLButtonElement>(null);

    // Scroll selected item into view
    useEffect(() => {
        if (selectedRef.current && containerRef.current) {
            const container = containerRef.current;
            const selected = selectedRef.current;
            
            const containerRect = container.getBoundingClientRect();
            const selectedRect = selected.getBoundingClientRect();
            
            if (selectedRect.top < containerRect.top) {
                container.scrollTop -= containerRect.top - selectedRect.top;
            } else if (selectedRect.bottom > containerRect.bottom) {
                container.scrollTop += selectedRect.bottom - containerRect.bottom;
            }
        }
    }, [selectedIndex]);

    // Close on outside click
    useEffect(() => {
        const handleClickOutside = (event: MouseEvent) => {
            if (
                containerRef.current &&
                !containerRef.current.contains(event.target as Node)
            ) {
                onClose();
            }
        };

        document.addEventListener("mousedown", handleClickOutside);
        return () => document.removeEventListener("mousedown", handleClickOutside);
    }, [onClose]);

    if (!position || plans.length === 0) {
        return null;
    }

    return (
        <div
            ref={containerRef}
            className="fixed z-50 min-w-[280px] max-w-[320px] rounded-md border border-border bg-popover shadow-lg"
            style={{
                top: `${position.top}px`,
                left: `${position.left}px`,
            }}
            role="listbox"
            aria-label="Plan suggestions"
        >
            <div className="max-h-[240px] overflow-y-auto p-1">
                {plans.map((plan, index) => {
                    const isSelected = index === selectedIndex;
                    return (
                        <button
                            key={plan.id}
                            ref={isSelected ? selectedRef : null}
                            type="button"
                            onClick={() => onSelect(plan)}
                            className={cn(
                                "w-full flex items-start gap-2 rounded px-2 py-2 text-left transition-colors",
                                isSelected
                                    ? "bg-primary/10 text-primary"
                                    : "text-foreground hover:bg-muted"
                            )}
                            role="option"
                            aria-selected={isSelected}
                        >
                            <FileText className="h-3.5 w-3.5 shrink-0 mt-0.5 text-primary" />
                            <div className="flex-1 min-w-0">
                                <div className="flex items-center gap-2 mb-0.5">
                                    <span className="text-xs font-medium truncate">
                                        {plan.filename.replace(/\.md$/, "")}
                                    </span>
                                    {plan.version > 1 && (
                                        <span className="text-[10px] text-muted-foreground">
                                            v{plan.version}
                                        </span>
                                    )}
                                </div>
                                {plan.metadata?.description && (
                                    <p className="text-[10px] text-muted-foreground line-clamp-1 mb-1">
                                        {plan.metadata.description}
                                    </p>
                                )}
                                <div className="flex items-center gap-1 text-[10px] text-muted-foreground">
                                    <Clock className="h-3 w-3" />
                                    <span>
                                        {formatPlanDate(plan.metadata?.createdAt)}
                                    </span>
                                </div>
                            </div>
                        </button>
                    );
                })}
            </div>
            {plans.length === 0 && query && (
                <div className="px-3 py-2 text-xs text-muted-foreground">
                    No plans found matching "{query}"
                </div>
            )}
        </div>
    );
}

