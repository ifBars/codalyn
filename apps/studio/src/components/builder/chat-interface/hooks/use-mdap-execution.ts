"use client";

import { useState, useTransition } from "react";
import type { AIMessage } from "@/lib/ai";
import { executeMdapInBrowser, saveArtifactsToLocalStorage, generateMdapSummary } from "@/lib/builder-mdap";
import type { MdapProgressUpdate } from "../../mdap-progress";
import type { AccuralAIModelId } from "@/lib/ai";
import type { Artifact } from "@codalyn/accuralai";
import type { StoredProject } from "@/lib/project-storage";

interface UseMdapExecutionParams {
    activeProject: StoredProject | null;
    googleApiKey: string | undefined;
    selectedModel?: AccuralAIModelId;
    setMessages: React.Dispatch<React.SetStateAction<AIMessage[]>>;
    setPlans: React.Dispatch<React.SetStateAction<Artifact[]>>;
    setIsLoading: (loading: boolean) => void;
    setShowScreenshotTip: (show: boolean) => void;
    onNewPlan?: (plan: any) => void;
    onNewArtifacts?: (artifacts: any[]) => void;
    onStatusMessage: (message: string) => void;
    existingPlans?: Artifact[];
}

export function useMdapExecution({
    activeProject,
    googleApiKey,
    selectedModel,
    setMessages,
    setPlans,
    setIsLoading,
    setShowScreenshotTip,
    onNewPlan,
    onNewArtifacts,
    onStatusMessage,
    existingPlans = [],
}: UseMdapExecutionParams) {
    const [isMdapExecuting, setIsMdapExecuting] = useState(false);
    const [mdapProgress, setMdapProgress] = useState<MdapProgressUpdate | null>(null);
    const [isPending, startTransition] = useTransition();

    const executeMdap = async (userMessage: string, referencedPlans: Artifact[] = []) => {
        if (!activeProject || !googleApiKey) return;

        const userMsg: AIMessage = { role: "user", content: userMessage };
        setMessages((prev) => [...prev, userMsg]);
        setIsMdapExecuting(true);
        setMdapProgress({ stage: "planning", message: "Initializing MDAP orchestrator..." });

        try {
            // Combine referenced plans from message with existing plans
            const allPlans = [...existingPlans, ...referencedPlans];
            const uniquePlans = Array.from(
                new Map(allPlans.map(plan => [plan.id, plan])).values()
            );

            const result = await executeMdapInBrowser(userMessage, {
                googleApiKey,
                modelName: selectedModel,
                existingPlans: uniquePlans,
                onProgress: (update) => {
                    setMdapProgress(update);
                },
            });

            // Save artifacts to localStorage
            if (result.artifacts.length > 0) {
                saveArtifactsToLocalStorage(activeProject.id, result.artifacts);
            }

            // Notify parent components
            if (result.planArtifact && onNewPlan) {
                onNewPlan(result.planArtifact);
            }
            if (result.artifacts.length > 0 && onNewArtifacts) {
                onNewArtifacts(result.artifacts);
            }

            // Update local plans state
            if (result.planArtifact) {
                setPlans((prev) => {
                    const existing = prev.find(p => p.id === result.planArtifact!.id);
                    if (existing) {
                        return prev.map(p => p.id === result.planArtifact!.id ? result.planArtifact! : p);
                    }
                    return [result.planArtifact!, ...prev];
                });
            }

            // Generate concise summary using gemini-2.5-flash-lite
            const summary = await generateMdapSummary(result, googleApiKey);
            
            // Add summary as assistant message
            startTransition(() => {
                setMessages((prev) => [
                    ...prev,
                    {
                        role: "assistant",
                        content: summary,
                    },
                ]);
            });

            // Keep progress visible (don't clear it)
            onStatusMessage(`MDAP generated ${result.artifacts.length} artifacts`);
        } catch (error) {
            console.error("MDAP execution error:", error);
            setMessages((prev) => [
                ...prev,
                {
                    role: "assistant",
                    content:
                        error instanceof Error
                            ? `MDAP Error: ${error.message}`
                            : "MDAP execution failed.",
                },
            ]);
            // Clear progress on error
            setMdapProgress(null);
        } finally {
            setIsLoading(false);
            setIsMdapExecuting(false);
            // Keep progress visible after completion - don't clear it
        }
    };

    const resetMdapProgress = () => {
        setIsMdapExecuting(false);
        setMdapProgress(null);
    };

    return {
        isMdapExecuting,
        mdapProgress,
        executeMdap,
        resetMdapProgress,
    };
}

