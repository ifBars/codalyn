"use client";

import { useEffect, useState } from "react";
import { Loader2, Check, AlertCircle, Sparkles, Brain, Code, TestTube, Eye, Palette, Bug, Building2, CheckCircle, FileCheck, ChevronDown, ChevronUp, Wrench, FileText } from "lucide-react";
import { cn } from "@/lib/utils";

export interface MdapProgressUpdate {
  stage: "planning" | "executing" | "qa" | "finalizing" | "complete";
  currentAgent?: string;
  currentTask?: string;
  progress?: number;
  message?: string;
  agentActivity?: AgentActivity[];
}

export interface AgentActivity {
  agentId: string;
  agentName: string;
  status: "idle" | "working" | "completed" | "error";
  task?: string;
  startedAt?: number;
  /** Full task description from decomposed plan */
  taskDescription?: string;
  /** Current iteration number */
  currentIteration?: number;
  /** Maximum iterations allowed */
  maxIterations?: number;
  /** Currently executing tool call */
  currentToolCall?: {
    name: string;
    args: any;
  };
  /** History of completed tool calls */
  completedToolCalls?: Array<{
    name: string;
    duration: number;
    success: boolean;
    error?: string;
  }>;
  /** Count of artifacts created so far */
  artifactsCreated?: number;
}

interface MdapProgressProps {
  progress: MdapProgressUpdate;
}

const AGENT_ICONS: Record<string, any> = {
  "code-generator": Code,
  "tester": TestTube,
  "code-reviewer": Eye,
  "ui-designer": Palette,
  "debugger": Bug,
  "architect": Building2,
  "qa-agent": CheckCircle,
  "finalizer": FileCheck,
  "planner": Brain,
};

const STAGE_LABELS: Record<string, string> = {
  planning: "Analyzing requirements",
  executing: "Agents working",
  qa: "Quality assurance",
  finalizing: "Finalizing output",
  complete: "Complete",
};

export function MdapProgress({ progress }: MdapProgressProps) {
  const [elapsed, setElapsed] = useState(0);
  const [expandedAgents, setExpandedAgents] = useState<Set<string>>(new Set());
  const startTime = useState(() => Date.now())[0];

  const { stage, currentAgent, currentTask, message, agentActivity } = progress;
  const isComplete = stage === "complete";

  const toggleExpand = (agentId: string) => {
    setExpandedAgents(prev => {
      const next = new Set(prev);
      if (next.has(agentId)) {
        next.delete(agentId);
      } else {
        next.add(agentId);
      }
      return next;
    });
  };

  useEffect(() => {
    // Stop timer when complete
    if (isComplete) {
      // Calculate final elapsed time once
      const finalElapsed = Math.floor((Date.now() - startTime) / 1000);
      setElapsed(finalElapsed);
      return;
    }

    // Update timer every second while running
    const interval = setInterval(() => {
      setElapsed(Math.floor((Date.now() - startTime) / 1000));
    }, 1000);

    return () => clearInterval(interval);
  }, [startTime, isComplete]);

  const formatTime = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return mins > 0 ? `${mins}m ${secs}s` : `${secs}s`;
  };

  return (
    <div className="rounded border border-border bg-card px-3 py-2.5 text-xs">
      {/* Header */}
      <div className="flex items-center justify-between mb-2">
        <div className="flex items-center gap-2">
          <Sparkles className="h-4 w-4 text-primary animate-pulse" />
          <span className="font-medium text-foreground">
            MDAP Multi-Agent System
          </span>
        </div>
        <span className="text-muted-foreground">{formatTime(elapsed)}</span>
      </div>

      {/* Stage Indicator */}
      <div className="mb-2">
        <div className="flex items-center gap-2">
          {!isComplete && <Loader2 className="h-3 w-3 animate-spin text-primary" />}
          {isComplete && <Check className="h-3 w-3 text-green-500" />}
          <span className="text-muted-foreground">{STAGE_LABELS[stage] || stage}</span>
        </div>
        {message && (
          <p className="mt-1 text-muted-foreground/80 text-[11px]">{message}</p>
        )}
      </div>

      {/* Agent Activity Grid */}
      {agentActivity && agentActivity.length > 0 && (
        <div className="mt-2 space-y-1">
          {agentActivity.map((activity) => {
            const Icon = AGENT_ICONS[activity.agentId] || Brain;
            const isWorking = activity.status === "working";
            const isCompleted = activity.status === "completed";
            const isError = activity.status === "error";
            const isExpanded = expandedAgents.has(activity.agentId);
            const hasDetails = !!(activity.taskDescription || activity.currentIteration !== undefined || activity.completedToolCalls?.length || activity.currentToolCall);

            return (
              <div
                key={activity.agentId}
                className={cn(
                  "rounded border transition-colors",
                  isWorking && "bg-primary/10 border-primary/20",
                  isCompleted && "bg-green-500/5 border-green-500/20",
                  isError && "bg-destructive/10 border-destructive/20",
                  !isWorking && !isCompleted && !isError && "bg-muted/20 border-border"
                )}
              >
                {/* Agent Header - Always Visible */}
                <div
                  className={cn(
                    "flex items-center gap-2 px-2 py-1.5 cursor-pointer",
                    hasDetails && "hover:bg-black/5"
                  )}
                  onClick={() => hasDetails && toggleExpand(activity.agentId)}
                >
                  <Icon className={cn(
                    "h-3.5 w-3.5 flex-shrink-0",
                    isWorking && "text-primary animate-pulse",
                    isCompleted && "text-green-500",
                    isError && "text-destructive",
                    !isWorking && !isCompleted && !isError && "text-muted-foreground"
                  )} />
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <span className={cn(
                        "font-medium truncate",
                        isWorking && "text-primary",
                        isCompleted && "text-green-500",
                        isError && "text-destructive",
                        !isWorking && !isCompleted && !isError && "text-muted-foreground"
                      )}>
                        {activity.agentName}
                      </span>
                      {isCompleted && <Check className="h-3 w-3 text-green-500 flex-shrink-0" />}
                      {isError && <AlertCircle className="h-3 w-3 text-destructive flex-shrink-0" />}
                      {isWorking && <Loader2 className="h-3 w-3 text-primary animate-spin flex-shrink-0" />}
                    </div>
                    {activity.task && (
                      <p className="text-[11px] text-muted-foreground/80 truncate mt-0.5">
                        {activity.task}
                      </p>
                    )}
                  </div>
                  {activity.startedAt && isWorking && (
                    <span className="text-[10px] text-muted-foreground flex-shrink-0">
                      {formatTime(Math.floor((Date.now() - activity.startedAt) / 1000))}
                    </span>
                  )}
                  {hasDetails && (
                    <button className="flex-shrink-0 text-muted-foreground hover:text-foreground">
                      {isExpanded ? (
                        <ChevronUp className="h-3 w-3" />
                      ) : (
                        <ChevronDown className="h-3 w-3" />
                      )}
                    </button>
                  )}
                </div>

                {/* Expanded Details */}
                {isExpanded && hasDetails && (
                  <div className="px-2 pb-2 pt-1 border-t border-border/50 space-y-2">
                    {/* Task Description */}
                    {activity.taskDescription && (
                      <div>
                        <div className="flex items-center gap-1 mb-1">
                          <FileText className="h-3 w-3 text-muted-foreground" />
                          <span className="text-[10px] font-medium text-muted-foreground">Task</span>
                        </div>
                        <p className="text-[11px] text-foreground/90 pl-4">
                          {activity.taskDescription}
                        </p>
                      </div>
                    )}

                    {/* Iteration Progress */}
                    {activity.currentIteration !== undefined && activity.maxIterations !== undefined && (
                      <div>
                        <div className="flex items-center justify-between mb-1">
                          <div className="flex items-center gap-1">
                            <Brain className="h-3 w-3 text-muted-foreground" />
                            <span className="text-[10px] font-medium text-muted-foreground">Iterations</span>
                          </div>
                          <span className="text-[10px] text-muted-foreground">
                            {activity.currentIteration} / {activity.maxIterations}
                          </span>
                        </div>
                        <div className="h-1.5 bg-muted rounded-full overflow-hidden pl-4">
                          <div
                            className="h-full bg-primary transition-all duration-300"
                            style={{
                              width: `${Math.min(100, (activity.currentIteration / activity.maxIterations) * 100)}%`,
                            }}
                          />
                        </div>
                      </div>
                    )}

                    {/* Current Tool Call */}
                    {activity.currentToolCall && (
                      <div>
                        <div className="flex items-center gap-1 mb-1">
                          <Wrench className="h-3 w-3 text-primary animate-pulse" />
                          <span className="text-[10px] font-medium text-primary">Executing</span>
                        </div>
                        <div className="pl-4 flex items-center gap-2">
                          <Loader2 className="h-2.5 w-2.5 text-primary animate-spin" />
                          <span className="text-[11px] text-foreground font-mono">
                            {activity.currentToolCall.name}
                          </span>
                        </div>
                      </div>
                    )}

                    {/* Completed Tool Calls */}
                    {activity.completedToolCalls && activity.completedToolCalls.length > 0 && (
                      <div>
                        <div className="flex items-center gap-1 mb-1">
                          <Wrench className="h-3 w-3 text-muted-foreground" />
                          <span className="text-[10px] font-medium text-muted-foreground">
                            Tool Calls ({activity.completedToolCalls.length})
                          </span>
                        </div>
                        <div className="pl-4 space-y-1 max-h-32 overflow-y-auto">
                          {activity.completedToolCalls.slice(-10).reverse().map((tc, idx) => (
                            <div
                              key={idx}
                              className={cn(
                                "flex items-center gap-2 text-[10px]",
                                tc.success ? "text-muted-foreground" : "text-destructive"
                              )}
                            >
                              {tc.success ? (
                                <Check className="h-2.5 w-2.5 text-green-500 flex-shrink-0" />
                              ) : (
                                <AlertCircle className="h-2.5 w-2.5 text-destructive flex-shrink-0" />
                              )}
                              <span className="font-mono">{tc.name}</span>
                              <span className="text-muted-foreground/60">
                                ({tc.duration}ms)
                              </span>
                              {tc.error && (
                                <span className="text-destructive/80 truncate max-w-[100px]" title={tc.error}>
                                  {tc.error}
                                </span>
                              )}
                            </div>
                          ))}
                        </div>
                      </div>
                    )}

                    {/* Artifacts Created */}
                    {activity.artifactsCreated !== undefined && activity.artifactsCreated > 0 && (
                      <div>
                        <div className="flex items-center gap-1">
                          <FileText className="h-3 w-3 text-muted-foreground" />
                          <span className="text-[10px] font-medium text-muted-foreground">
                            Artifacts Created: {activity.artifactsCreated}
                          </span>
                        </div>
                      </div>
                    )}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}

      {/* Simple Current Task Display (fallback if no agentActivity) */}
      {!agentActivity && currentAgent && currentTask && (
        <div className="mt-2 flex items-center gap-2 rounded bg-primary/10 border border-primary/20 px-2 py-1.5">
          {(() => {
            const Icon = AGENT_ICONS[currentAgent] || Brain;
            return <Icon className="h-3.5 w-3.5 text-primary animate-pulse" />;
          })()}
          <div className="flex-1 min-w-0">
            <p className="text-primary font-medium text-[11px] truncate">{currentAgent}</p>
            <p className="text-muted-foreground/80 text-[10px] truncate">{currentTask}</p>
          </div>
        </div>
      )}
    </div>
  );
}
