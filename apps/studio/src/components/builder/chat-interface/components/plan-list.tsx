"use client";

import { FileText, Clock, Trash2 } from "lucide-react";
import { cn } from "@/lib/utils";
import type { Artifact } from "@codalyn/accuralai";

interface PlanListProps {
    plans: Artifact[];
    selectedPlan: Artifact | null;
    onSelectPlan: (plan: Artifact) => void;
    onDeletePlan: (e: React.MouseEvent, plan: Artifact) => void;
    formatPlanDate: (date: Date | undefined) => string;
}

export function PlanList({
    plans,
    selectedPlan,
    onSelectPlan,
    onDeletePlan,
    formatPlanDate,
}: PlanListProps) {
    if (plans.length === 0) return null;

    return (
        <div className="border-b border-border bg-card/30">
            <div className="max-h-[300px] overflow-y-auto p-3 space-y-2">
                {plans.map((plan) => (
                    <div
                        key={plan.id}
                        className={cn(
                            "relative w-full rounded-md border p-2.5 transition-colors group",
                            selectedPlan?.id === plan.id
                                ? "bg-primary/5 border-primary/50"
                                : "bg-card border-border/50 hover:bg-muted/50 hover:border-primary/30"
                        )}
                    >
                        <button
                            onClick={() => onSelectPlan(plan)}
                            className="w-full text-left pr-6"
                        >
                            <div className="flex items-start gap-2">
                                <FileText className="h-3.5 w-3.5 shrink-0 text-primary mt-0.5" />
                                <div className="flex-1 min-w-0">
                                    <div className="flex items-center gap-2 mb-1">
                                        <span className="text-xs font-medium truncate text-foreground">
                                            {plan.filename}
                                        </span>
                                        {plan.version > 1 && (
                                            <span className="text-[10px] text-muted-foreground">v{plan.version}</span>
                                        )}
                                    </div>
                                    {plan.metadata?.description && (
                                        <p className="text-[10px] text-muted-foreground line-clamp-2 mb-1.5">
                                            {plan.metadata.description}
                                        </p>
                                    )}
                                    <div className="flex items-center gap-1.5 text-[10px] text-muted-foreground">
                                        <Clock className="h-3 w-3" />
                                        <span>{formatPlanDate(plan.metadata?.createdAt)}</span>
                                    </div>
                                </div>
                            </div>
                        </button>
                        <button
                            onClick={(e) => onDeletePlan(e, plan)}
                            className="absolute right-2 top-2 opacity-0 group-hover:opacity-100 p-1 rounded hover:bg-destructive/10 text-muted-foreground hover:text-destructive transition-opacity"
                            title="Delete plan"
                        >
                            <Trash2 className="h-3 w-3" />
                        </button>
                    </div>
                ))}
            </div>
        </div>
    );
}

