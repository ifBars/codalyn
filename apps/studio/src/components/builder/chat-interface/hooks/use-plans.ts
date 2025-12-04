"use client";

import { useEffect, useState } from "react";
import type { Artifact } from "@codalyn/accuralai";
import { getPlansFromLocalStorage, deleteArtifactFromLocalStorage } from "@/lib/builder-mdap";
import type { StoredProject } from "@/lib/project-storage";

export function formatPlanDate(date: Date | undefined): string {
    if (!date) return "Unknown";
    return new Date(date).toLocaleDateString("en-US", {
        month: "short",
        day: "numeric",
        hour: "2-digit",
        minute: "2-digit",
    });
}

interface UsePlansParams {
    activeProject: StoredProject | null;
    externalPlans: Artifact[];
    onStatusMessage: (message: string) => void;
}

export function usePlans({ activeProject, externalPlans, onStatusMessage }: UsePlansParams) {
    const [plans, setPlans] = useState<Artifact[]>(externalPlans);
    const [showPlans, setShowPlans] = useState(false);
    const [selectedPlan, setSelectedPlan] = useState<Artifact | null>(null);
    const [showPlanDetail, setShowPlanDetail] = useState(false);

    // Sync plans from external prop and localStorage with proper deduplication
    useEffect(() => {
        if (activeProject) {
            const storedPlans = getPlansFromLocalStorage(activeProject.id);
            // Merge external plans with stored plans, deduplicating by ID
            // Prefer the one with the latest updatedAt/createdAt timestamp
            const planMap = new Map<string, Artifact>();
            
            [...storedPlans, ...externalPlans].forEach(plan => {
                const existing = planMap.get(plan.id);
                if (!existing) {
                    planMap.set(plan.id, plan);
                } else {
                    // Keep the one with the latest timestamp
                    const existingDate = existing.metadata?.updatedAt 
                        ? new Date(existing.metadata.updatedAt).getTime()
                        : existing.metadata?.createdAt 
                            ? new Date(existing.metadata.createdAt).getTime()
                            : 0;
                    const planDate = plan.metadata?.updatedAt
                        ? new Date(plan.metadata.updatedAt).getTime()
                        : plan.metadata?.createdAt
                            ? new Date(plan.metadata.createdAt).getTime()
                            : 0;
                    if (planDate > existingDate) {
                        planMap.set(plan.id, plan);
                    }
                }
            });
            
            const mergedPlans = Array.from(planMap.values()).sort((a, b) => {
                const dateA = a.metadata?.createdAt ? new Date(a.metadata.createdAt).getTime() : 0;
                const dateB = b.metadata?.createdAt ? new Date(b.metadata.createdAt).getTime() : 0;
                return dateB - dateA; // Newest first
            });
            setPlans(mergedPlans);
        } else {
            setPlans([]);
        }
    }, [activeProject, externalPlans]);

    const handlePlanSelect = (plan: Artifact) => {
        setSelectedPlan(plan);
        setShowPlanDetail(true);
    };

    const handleDeletePlan = (e: React.MouseEvent, plan: Artifact) => {
        e.stopPropagation();
        if (!activeProject) return;
        
        if (confirm(`Are you sure you want to delete "${plan.filename}"?`)) {
            const deleted = deleteArtifactFromLocalStorage(activeProject.id, plan.id);
            if (deleted) {
                setPlans((prev) => prev.filter(p => p.id !== plan.id));
                if (selectedPlan?.id === plan.id) {
                    setSelectedPlan(null);
                    setShowPlanDetail(false);
                }
                onStatusMessage(`Plan "${plan.filename}" deleted.`);
            }
        }
    };

    return {
        plans,
        setPlans,
        showPlans,
        setShowPlans,
        selectedPlan,
        setSelectedPlan,
        showPlanDetail,
        setShowPlanDetail,
        handlePlanSelect,
        handleDeletePlan,
    };
}

