"use client";

import { FileText, Clock, X } from "lucide-react";
import { MarkdownContent } from "@/components/ui/markdown-content";
import type { Artifact } from "@codalyn/accuralai";

interface PlanDetailModalProps {
    plan: Artifact;
    onClose: () => void;
    formatPlanDate: (date: Date | undefined) => string;
}

export function PlanDetailModal({ plan, onClose, formatPlanDate }: PlanDetailModalProps) {
    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-background/80 backdrop-blur-sm p-4">
            <div className="relative w-full max-w-4xl max-h-[90vh] flex flex-col bg-background border border-border rounded-lg shadow-lg">
                {/* Header */}
                <div className="flex items-center justify-between border-b border-border px-6 py-4">
                    <div className="flex items-center gap-3 flex-1 min-w-0">
                        <div className="p-2 rounded-md bg-primary/10">
                            <FileText className="h-5 w-5 text-primary" />
                        </div>
                        <div className="flex-1 min-w-0">
                            <h2 className="text-lg font-semibold text-foreground truncate">
                                {plan.filename}
                            </h2>
                            <div className="flex items-center gap-3 mt-1">
                                <span className="text-xs text-muted-foreground flex items-center gap-1.5">
                                    <Clock className="h-3 w-3" />
                                    {formatPlanDate(plan.metadata?.createdAt)}
                                </span>
                                {plan.version > 1 && (
                                    <span className="text-xs text-muted-foreground">
                                        v{plan.version}
                                    </span>
                                )}
                            </div>
                        </div>
                    </div>
                    <button
                        onClick={onClose}
                        className="ml-4 p-2 rounded-md hover:bg-muted transition-colors"
                    >
                        <X className="h-5 w-5 text-muted-foreground" />
                    </button>
                </div>
                
                {/* Content */}
                <div className="flex-1 overflow-y-auto p-6">
                    {plan.metadata?.description && (
                        <p className="text-sm text-muted-foreground mb-6 pb-6 border-b border-border">
                            {plan.metadata.description}
                        </p>
                    )}
                    <div className="prose prose-sm dark:prose-invert max-w-none">
                        <MarkdownContent content={plan.content} />
                    </div>
                </div>
            </div>
        </div>
    );
}

