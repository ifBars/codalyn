"use client";

import React, { useState } from "react";
import { FileText, Calendar, User, Clock, ChevronRight, Folder, Search, Copy, Check, Sparkles, Layers } from "lucide-react";
import { MarkdownContent } from "@/components/ui/markdown-content";
import { cn } from "@/lib/utils";
import type { Artifact } from "@codalyn/accuralai";

interface PlansViewerProps {
  plans: Artifact[];
  currentPlan?: Artifact | null;
  onSelectPlan?: (plan: Artifact) => void;
  className?: string;
  compact?: boolean;
}

/**
 * PlansViewer - Displays MDAP execution plans with chronological list and detail view
 * Following the Aurelius MDAP pattern for plan visualization
 */
export function PlansViewer({
  plans,
  currentPlan,
  onSelectPlan,
  className,
  compact = false
}: PlansViewerProps) {
  const [selectedPlanId, setSelectedPlanId] = useState<string | null>(
    currentPlan?.id || null
  );
  const [searchQuery, setSearchQuery] = useState("");
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const [showMobileDetail, setShowMobileDetail] = useState(false);

  // Deduplicate plans by ID (keep most recent based on createdAt)
  const uniquePlans = React.useMemo(() => {
    const planMap = new Map<string, Artifact>();
    plans.forEach(plan => {
      const existing = planMap.get(plan.id);
      if (!existing) {
        planMap.set(plan.id, plan);
      } else {
        // Keep the one with the latest createdAt
        const existingDate = existing.metadata?.createdAt ? new Date(existing.metadata.createdAt).getTime() : 0;
        const planDate = plan.metadata?.createdAt ? new Date(plan.metadata.createdAt).getTime() : 0;
        if (planDate > existingDate) {
          planMap.set(plan.id, plan);
        }
      }
    });
    return Array.from(planMap.values()).sort((a, b) => {
      const dateA = a.metadata?.createdAt ? new Date(a.metadata.createdAt).getTime() : 0;
      const dateB = b.metadata?.createdAt ? new Date(b.metadata.createdAt).getTime() : 0;
      return dateB - dateA; // Newest first
    });
  }, [plans]);

  const displayPlan = currentPlan || uniquePlans.find(p => p.id === selectedPlanId) || uniquePlans[0];

  const handleSelectPlan = (plan: Artifact) => {
    setSelectedPlanId(plan.id);
    onSelectPlan?.(plan);
    if (compact) {
      setShowMobileDetail(true);
    }
  };

  const handleBackToList = () => {
    setShowMobileDetail(false);
  };

  const handleCopy = async (text: string, id: string) => {
    try {
      await navigator.clipboard.writeText(text);
      setCopiedId(id);
      setTimeout(() => setCopiedId(null), 2000);
    } catch (err) {
      console.error("Failed to copy:", err);
    }
  };

  const formatDate = (date: Date | undefined) => {
    if (!date) return "Unknown";
    return new Date(date).toLocaleDateString("en-US", {
      month: "short",
      day: "numeric",
      year: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    });
  };

  const filteredPlans = uniquePlans.filter(plan =>
    plan.filename.toLowerCase().includes(searchQuery.toLowerCase()) ||
    plan.metadata?.description?.toLowerCase().includes(searchQuery.toLowerCase())
  );

  if (plans.length === 0) {
    return (
      <div className={cn("flex h-full flex-col bg-background", className)}>
        <EmptyState />
      </div>
    );
  }

  // Compact Mode (Drill-down)
  if (compact) {
    if (showMobileDetail && displayPlan) {
      return (
        <div className={cn("flex h-full flex-col bg-background", className)}>
          <div className="flex items-center gap-2 border-b border-border p-3">
            <button
              onClick={handleBackToList}
              className="flex items-center gap-1 text-xs font-medium text-muted-foreground hover:text-foreground"
            >
              <ChevronRight className="h-4 w-4 rotate-180" />
              Back
            </button>
            <span className="text-sm font-medium truncate ml-2">{displayPlan.filename}</span>
          </div>
          <div className="flex-1 overflow-y-auto p-4">
            <div className="prose prose-sm dark:prose-invert max-w-none">
              <MarkdownContent
                content={displayPlan.content}
                className="text-sm leading-relaxed"
              />
            </div>
          </div>
        </div>
      );
    }

    return (
      <div className={cn("flex h-full flex-col bg-background", className)}>
        <div className="p-3 border-b border-border">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
            <input
              type="text"
              placeholder="Search plans..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full rounded-md border border-border bg-background pl-8 pr-3 py-1.5 text-xs outline-none focus:ring-1 focus:ring-primary/20 focus:border-primary"
            />
          </div>
        </div>
        <div className="flex-1 overflow-y-auto p-2 space-y-1">
          {filteredPlans.map((plan) => (
            <PlanListItem
              key={plan.id}
              plan={plan}
              onClick={() => handleSelectPlan(plan)}
              isActive={plan.id === selectedPlanId}
            />
          ))}
        </div>
      </div>
    );
  }

  // Full Mode (Sidebar + Content)
  return (
    <div className={cn("flex h-full flex-col bg-background", className)}>
      <div className="flex flex-1 overflow-hidden">
        {/* Plans List - Left Sidebar */}
        <div className="w-80 border-r border-border flex flex-col bg-card/30">
          {/* Search Header */}
          <div className="p-4 border-b border-border">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <input
                type="text"
                placeholder="Search plans..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full rounded-lg border border-border bg-background pl-9 pr-4 py-2 text-sm outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary transition-all"
              />
            </div>
          </div>

          {/* List */}
          <div className="flex-1 overflow-y-auto p-3 space-y-2">
            {filteredPlans.length === 0 ? (
              <div className="text-center py-8 text-muted-foreground text-sm">
                No plans found
              </div>
            ) : (
              filteredPlans.map((plan) => {
                const isSelected = plan.id === displayPlan?.id;
                const createdAt = plan.metadata?.createdAt;

                return (
                  <button
                    key={plan.id}
                    onClick={() => handleSelectPlan(plan)}
                    className={cn(
                      "w-full group relative rounded-xl p-3 text-left transition-all duration-200 border",
                      isSelected
                        ? "bg-primary/5 border-primary/50 shadow-sm"
                        : "bg-card border-transparent hover:bg-card/80 hover:border-border/50"
                    )}
                  >
                    <div className="flex items-start justify-between gap-3">
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 mb-1.5">
                          <div className={cn(
                            "p-1.5 rounded-md",
                            isSelected ? "bg-primary/20 text-primary" : "bg-muted text-muted-foreground group-hover:text-foreground"
                          )}>
                            <FileText className="h-3.5 w-3.5" />
                          </div>
                          <span className={cn(
                            "text-sm font-medium truncate",
                            isSelected ? "text-primary" : "text-foreground"
                          )}>
                            {plan.filename}
                          </span>
                        </div>

                        {plan.metadata?.description && (
                          <p className="text-xs text-muted-foreground line-clamp-2 mb-2 pl-1">
                            {plan.metadata.description}
                          </p>
                        )}

                        <div className="flex items-center gap-3 text-[10px] text-muted-foreground pl-1">
                          <span className="flex items-center gap-1">
                            <Clock className="h-3 w-3" />
                            {formatDate(createdAt)}
                          </span>
                          {plan.version > 1 && (
                            <span className="bg-muted/50 px-1.5 py-0.5 rounded text-foreground/70">
                              v{plan.version}
                            </span>
                          )}
                        </div>
                      </div>
                    </div>

                    {isSelected && (
                      <div className="absolute right-3 top-1/2 -translate-y-1/2">
                        <ChevronRight className="h-4 w-4 text-primary opacity-50" />
                      </div>
                    )}
                  </button>
                );
              })
            )}
          </div>
        </div>

        {/* Plan Content - Main Area */}
        <div className="flex-1 overflow-y-auto bg-background/50">
          {displayPlan ? (
            <div className="h-full flex flex-col">
              {/* Content Header */}
              <div className="border-b border-border bg-card/50 px-8 py-6 backdrop-blur-sm sticky top-0 z-10">
                <div className="flex items-start justify-between gap-4">
                  <div className="space-y-1">
                    <div className="flex items-center gap-3">
                      <h1 className="text-xl font-semibold text-foreground tracking-tight">
                        {displayPlan.filename}
                      </h1>
                      <span className="inline-flex items-center gap-1 rounded-full bg-primary/10 px-2.5 py-0.5 text-xs font-medium text-primary border border-primary/20">
                        <Sparkles className="h-3 w-3" />
                        MDAP Plan
                      </span>
                    </div>
                    <p className="text-sm text-muted-foreground max-w-2xl">
                      {displayPlan.metadata?.description || "No description provided"}
                    </p>
                  </div>

                  <button
                    onClick={() => handleCopy(displayPlan.content, displayPlan.id)}
                    className="flex items-center gap-2 rounded-lg border border-border bg-background px-3 py-1.5 text-xs font-medium text-foreground transition-colors hover:bg-muted hover:text-primary"
                  >
                    {copiedId === displayPlan.id ? (
                      <>
                        <Check className="h-3.5 w-3.5 text-green-500" />
                        Copied
                      </>
                    ) : (
                      <>
                        <Copy className="h-3.5 w-3.5" />
                        Copy Markdown
                      </>
                    )}
                  </button>
                </div>

                {/* Metadata Grid */}
                <div className="mt-6 grid grid-cols-2 md:grid-cols-4 gap-4">
                  <MetadataItem
                    icon={Calendar}
                    label="Created"
                    value={formatDate(displayPlan.metadata?.createdAt)}
                  />
                  <MetadataItem
                    icon={User}
                    label="Agent Role"
                    value={displayPlan.metadata?.agentRole || "Planner"}
                  />
                  <MetadataItem
                    icon={Layers}
                    label="Version"
                    value={`v${displayPlan.version}`}
                  />
                  <MetadataItem
                    icon={FileText}
                    label="Type"
                    value="Execution Plan"
                  />
                </div>
              </div>

              {/* Markdown Content */}
              <div className="flex-1 p-8 max-w-4xl mx-auto w-full">
                <div className="prose prose-sm dark:prose-invert max-w-none prose-headings:font-semibold prose-a:text-primary prose-pre:bg-muted/50 prose-pre:border prose-pre:border-border">
                  <MarkdownContent
                    content={displayPlan.content}
                    className="text-sm leading-relaxed"
                  />
                </div>
              </div>
            </div>
          ) : (
            <div className="flex h-full items-center justify-center p-8">
              <div className="text-center text-muted-foreground">
                <Layers className="mx-auto h-12 w-12 opacity-20 mb-4" />
                <p className="text-sm">Select a plan from the list to view details</p>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

function MetadataItem({ icon: Icon, label, value }: { icon: any, label: string, value: string }) {
  return (
    <div className="flex items-center gap-3 rounded-lg border border-border/50 bg-background/50 p-2.5">
      <div className="rounded-md bg-muted p-2">
        <Icon className="h-4 w-4 text-muted-foreground" />
      </div>
      <div>
        <p className="text-[10px] font-medium uppercase tracking-wider text-muted-foreground/70">
          {label}
        </p>
        <p className="text-xs font-medium text-foreground mt-0.5">
          {value}
        </p>
      </div>
    </div>
  );
}

function EmptyState() {
  return (
    <>
      <div className="border-b border-border px-4 py-3">
        <div className="flex items-center gap-2">
          <Folder className="h-4 w-4 text-primary" />
          <span className="text-sm font-medium">MDAP Plans</span>
        </div>
        <p className="mt-1 text-xs text-muted-foreground">
          Execution plans will appear here
        </p>
      </div>

      <div className="flex flex-1 items-center justify-center p-8">
        <div className="text-center">
          <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-muted/30">
            <Sparkles className="h-8 w-8 text-muted-foreground/30" />
          </div>
          <h3 className="text-base font-medium text-foreground">No plans generated yet</h3>
          <p className="mt-2 text-sm text-muted-foreground max-w-xs mx-auto">
            When the AI uses MDAP orchestration to solve complex tasks, execution plans will appear here.
          </p>
        </div>
      </div>
    </>
  );
}

/**
 * Compact plan list item for use in smaller spaces
 */
export function PlanListItem({
  plan,
  onClick,
  isActive = false
}: {
  plan: Artifact;
  onClick?: () => void;
  isActive?: boolean;
}) {
  const formatDate = (date: Date | undefined) => {
    if (!date) return "Unknown";
    return new Date(date).toLocaleDateString("en-US", {
      month: "short",
      day: "numeric",
    });
  };

  return (
    <button
      onClick={onClick}
      className={cn(
        "w-full rounded-md p-2 text-left transition-colors",
        "hover:bg-muted/50",
        isActive && "bg-muted"
      )}
    >
      <div className="flex items-center gap-2">
        <FileText className="h-4 w-4 shrink-0 text-primary" />
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2">
            <span className="text-xs font-medium truncate">{plan.filename}</span>
            {plan.version > 1 && (
              <span className="text-xs text-muted-foreground">v{plan.version}</span>
            )}
          </div>
          <div className="text-xs text-muted-foreground">
            {formatDate(plan.metadata?.createdAt)}
          </div>
        </div>
      </div>
    </button>
  );
}
