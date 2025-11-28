"use client";

import { useEffect, useState } from "react";
import { Loader2, Check, AlertCircle, Sparkles, Brain, Code, TestTube, Eye, Palette, Bug, Building2, CheckCircle, FileCheck } from "lucide-react";
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
  const startTime = useState(() => Date.now())[0];

  useEffect(() => {
    const interval = setInterval(() => {
      setElapsed(Math.floor((Date.now() - startTime) / 1000));
    }, 1000);

    return () => clearInterval(interval);
  }, [startTime]);

  const formatTime = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return mins > 0 ? `${mins}m ${secs}s` : `${secs}s`;
  };

  const { stage, currentAgent, currentTask, message, agentActivity } = progress;
  const isComplete = stage === "complete";

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

            return (
              <div
                key={activity.agentId}
                className={cn(
                  "flex items-center gap-2 rounded px-2 py-1.5 transition-colors",
                  isWorking && "bg-primary/10 border border-primary/20",
                  isCompleted && "bg-green-500/5 border border-green-500/20",
                  isError && "bg-destructive/10 border border-destructive/20",
                  !isWorking && !isCompleted && !isError && "bg-muted/20"
                )}
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
