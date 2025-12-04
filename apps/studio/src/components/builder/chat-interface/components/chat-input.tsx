"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import { ArrowUp, FileText } from "lucide-react";
import type { Artifact } from "@codalyn/accuralai";
import { PlanMentionAutocomplete } from "./plan-mention-autocomplete";
import {
    getCurrentMention,
    filterPlansByQuery,
    createPlanMention,
} from "../utils/plan-mentions";
import { cn } from "@/lib/utils";

interface ChatInputProps {
    input: string;
    setInput: (value: string) => void;
    onSend: () => void;
    canSend: boolean;
    showScreenshotTip: boolean;
    activeProject: boolean;
    isInitializing: boolean;
    textareaRef: React.RefObject<HTMLTextAreaElement>;
    plans?: Artifact[];
}

export function ChatInput({
    input,
    setInput,
    onSend,
    canSend,
    showScreenshotTip,
    activeProject,
    isInitializing,
    textareaRef,
    plans = [],
}: ChatInputProps) {
    const [showAutocomplete, setShowAutocomplete] = useState(false);
    const [autocompleteQuery, setAutocompleteQuery] = useState("");
    const [selectedIndex, setSelectedIndex] = useState(0);
    const [autocompletePosition, setAutocompletePosition] = useState<{
        top: number;
        left: number;
    } | null>(null);
    const [hintPosition, setHintPosition] = useState<{
        top: number;
        left: number;
    } | null>(null);
    const containerRef = useRef<HTMLDivElement>(null);

    // Update autocomplete position based on cursor
    const updateAutocompletePosition = useCallback(() => {
        if (!textareaRef.current || !containerRef.current) {
            return;
        }

        const textarea = textareaRef.current;
        const textBeforeCursor = input.substring(0, textarea.selectionStart || 0);
        const lastAt = textBeforeCursor.lastIndexOf("@");

        if (lastAt === -1) {
            setShowAutocomplete(false);
            setHintPosition(null);
            return;
        }

        // Get textarea position relative to viewport
        const textareaRect = textarea.getBoundingClientRect();
        
        // Calculate position - place dropdown below textarea
        // Using fixed positioning, so use viewport coordinates
        const top = textareaRect.bottom + 4; // 4px gap below textarea
        const left = textareaRect.left + 12; // Align with textarea padding

        setAutocompletePosition({ top, left });

        // Calculate hint position - place above textarea, aligned with @ symbol
        // Calculate height needed for the autocomplete list (estimate: ~28px per item, max 4 items visible)
        // Compute filtered plans here to avoid dependency issues
        const currentFilteredPlans = filterPlansByQuery(plans, autocompleteQuery);
        const headerHeight = 28; // Header with "Press Tab" text
        const itemHeight = 28; // Height per item
        const estimatedHeight = Math.min(currentFilteredPlans.length, 4) * itemHeight + headerHeight + 8; // 8px padding
        const hintTop = textareaRect.top - estimatedHeight - 4; // Position above textarea with gap
        const hintLeft = textareaRect.left + 12; // Align with textarea padding

        setHintPosition({ top: hintTop, left: hintLeft });
    }, [input, textareaRef, plans, autocompleteQuery]);

    // Check for @ mentions and show autocomplete
    useEffect(() => {
        if (!textareaRef.current || !plans || plans.length === 0) {
            setShowAutocomplete(false);
            setHintPosition(null);
            return;
        }

        const cursorPos = textareaRef.current.selectionStart || 0;
        const mention = getCurrentMention(input, cursorPos);

        if (mention) {
            setAutocompleteQuery(mention.query);
            setShowAutocomplete(true);
            setSelectedIndex(0);
            updateAutocompletePosition();
        } else {
            setShowAutocomplete(false);
            setHintPosition(null);
        }
    }, [input, plans, textareaRef, updateAutocompletePosition]);

    // Filter plans based on query
    const filteredPlans = filterPlansByQuery(plans, autocompleteQuery);
    
    // Limit displayed plans in hint (show max 4)
    const displayedPlans = filteredPlans.slice(0, 4);
    
    // Update hint position when filtered plans change
    useEffect(() => {
        if (showAutocomplete && filteredPlans.length > 0) {
            updateAutocompletePosition();
        }
    }, [filteredPlans.length, showAutocomplete, updateAutocompletePosition]);

    // Insert plan mention into input
    const insertPlanMention = useCallback(
        (plan: Artifact, addSpace: boolean = true) => {
            if (!textareaRef.current) return;

            const textarea = textareaRef.current;
            const cursorPos = textarea.selectionStart || 0;
            const textBeforeCursor = input.substring(0, cursorPos);
            const textAfterCursor = input.substring(cursorPos);
            const lastAt = textBeforeCursor.lastIndexOf("@");

            if (lastAt === -1) return;

            const mention = createPlanMention(plan);
            const separator = addSpace ? " " : "";
            const newText =
                input.substring(0, lastAt) + mention + separator + textAfterCursor;
            const newCursorPos = lastAt + mention.length + (addSpace ? 1 : 0);

            setInput(newText);
            setShowAutocomplete(false);

            // Set cursor position after state update
            setTimeout(() => {
                if (textareaRef.current) {
                    textareaRef.current.setSelectionRange(newCursorPos, newCursorPos);
                    textareaRef.current.focus();
                }
            }, 0);
        },
        [input, setInput, textareaRef]
    );

    // Complete mention with Tab key
    const completeMentionWithTab = useCallback(() => {
        if (!textareaRef.current || !plans || plans.length === 0) {
            return false;
        }

        const textarea = textareaRef.current;
        const cursorPos = textarea.selectionStart || 0;
        const mention = getCurrentMention(input, cursorPos);

        if (!mention) {
            return false;
        }

        // If autocomplete is visible, use the selected plan
        if (showAutocomplete && filteredPlans.length > 0) {
            const planToUse = filteredPlans[selectedIndex] || filteredPlans[0];
            if (planToUse) {
                insertPlanMention(planToUse, true);
                return true;
            }
        }

        // Otherwise, try to find a match for the current query
        const matchingPlans = filterPlansByQuery(plans, mention.query);
        if (matchingPlans.length > 0) {
            // Use the first match (best match)
            insertPlanMention(matchingPlans[0], true);
            return true;
        }

        return false;
    }, [
        input,
        plans,
        showAutocomplete,
        filteredPlans,
        selectedIndex,
        insertPlanMention,
    ]);

    // Handle keyboard navigation in autocomplete
    const handleKeyDown = useCallback(
        (event: React.KeyboardEvent<HTMLTextAreaElement>) => {
            // Handle Tab completion
            if (event.key === "Tab") {
                const completed = completeMentionWithTab();
                if (completed) {
                    event.preventDefault();
                    return;
                }
                // If Tab didn't complete anything, allow default behavior (focus next element)
                return;
            }

            if (showAutocomplete && filteredPlans.length > 0) {
                if (event.key === "ArrowDown") {
                    event.preventDefault();
                    setSelectedIndex((prev) =>
                        prev < filteredPlans.length - 1 ? prev + 1 : prev
                    );
                    return;
                }
                if (event.key === "ArrowUp") {
                    event.preventDefault();
                    setSelectedIndex((prev) => (prev > 0 ? prev - 1 : 0));
                    return;
                }
                if (event.key === "Enter" && !event.shiftKey) {
                    event.preventDefault();
                    const selectedPlan = filteredPlans[selectedIndex];
                    if (selectedPlan) {
                        insertPlanMention(selectedPlan);
                        return;
                    }
                }
                if (event.key === "Escape") {
                    event.preventDefault();
                    setShowAutocomplete(false);
                    return;
                }
            }

            // Default Enter behavior (send message)
            if (event.key === "Enter" && !event.shiftKey) {
                event.preventDefault();
                onSend();
            }
        },
        [
            showAutocomplete,
            filteredPlans,
            selectedIndex,
            onSend,
            completeMentionWithTab,
            insertPlanMention,
        ]
    );

    // Handle plan selection from autocomplete
    const handlePlanSelect = useCallback(
        (plan: Artifact) => {
            insertPlanMention(plan);
        },
        [insertPlanMention]
    );

    return (
        <div ref={containerRef} className="relative border-t border-border bg-background p-3 space-y-2">
            {showScreenshotTip && (
                <div className="rounded border border-primary/40 bg-primary/10 px-3 py-2">
                    <p className="text-[10px] text-primary">
                        💡 The AI is capturing a screenshot of the preview to see the current UI state.
                    </p>
                </div>
            )}

            <div className="flex gap-2 relative">
                <textarea
                    ref={textareaRef}
                    value={input}
                    onChange={(event) => setInput(event.target.value)}
                    onKeyDown={handleKeyDown}
                    onSelect={updateAutocompletePosition}
                    onClick={updateAutocompletePosition}
                    placeholder={activeProject ? "Describe what to build next…" : "Select a project first"}
                    disabled={!activeProject || isInitializing}
                    className="flex-1 resize-none rounded border border-border bg-input px-3 py-2 text-xs text-foreground placeholder-muted-foreground focus:border-primary focus:outline-none disabled:opacity-60"
                    rows={2}
                />
                <button
                    onClick={onSend}
                    disabled={!canSend}
                    className="rounded bg-primary p-2 text-primary-foreground transition hover:opacity-90 disabled:opacity-40"
                    title="Send message"
                >
                    <ArrowUp className="h-4 w-4" />
                </button>
            </div>

            {/* Inline autocomplete hint with plan list */}
            {showAutocomplete && filteredPlans.length > 0 && hintPosition && (
                <div
                    className="fixed z-40 min-w-[280px] max-w-[400px] rounded-md border border-primary/30 bg-popover shadow-lg"
                    style={{
                        top: `${hintPosition.top}px`,
                        left: `${hintPosition.left}px`,
                    }}
                >
                    <div className="border-b border-border/50 px-2 py-1.5">
                        <div className="flex items-center gap-1.5 text-[10px] text-muted-foreground">
                            <span>Press <kbd className="rounded border border-border bg-background px-1 py-0.5 font-mono text-[9px]">Tab</kbd> to complete</span>
                            {filteredPlans.length > displayedPlans.length && (
                                <span className="text-[9px]">• {filteredPlans.length - displayedPlans.length} more</span>
                            )}
                        </div>
                    </div>
                    <div className="max-h-[96px] overflow-y-auto p-1">
                        {displayedPlans.map((plan, index) => {
                            // Check if this plan matches the selected plan from filteredPlans
                            const isSelected = filteredPlans[selectedIndex]?.id === plan.id;
                            return (
                                <div
                                    key={plan.id}
                                    className={cn(
                                        "flex items-center gap-2 rounded px-2 py-1.5 text-left transition-colors cursor-pointer",
                                        isSelected
                                            ? "bg-primary/10 text-primary"
                                            : "text-foreground hover:bg-muted/50"
                                    )}
                                    onClick={() => insertPlanMention(plan)}
                                >
                                    <FileText className="h-3 w-3 shrink-0 text-primary" />
                                    <div className="flex-1 min-w-0">
                                        <div className="flex items-center gap-1.5">
                                            <span className="text-[11px] font-medium truncate">
                                                {plan.filename.replace(/\.md$/, "")}
                                            </span>
                                            {plan.version > 1 && (
                                                <span className="text-[9px] text-muted-foreground">
                                                    v{plan.version}
                                                </span>
                                            )}
                                        </div>
                                        {plan.metadata?.description && (
                                            <p className="text-[9px] text-muted-foreground line-clamp-1 mt-0.5">
                                                {plan.metadata.description}
                                            </p>
                                        )}
                                    </div>
                                    {isSelected && (
                                        <kbd className="text-[9px] text-primary/70">Tab</kbd>
                                    )}
                                </div>
                            );
                        })}
                    </div>
                </div>
            )}

            {showAutocomplete && (
                <PlanMentionAutocomplete
                    plans={filteredPlans}
                    query={autocompleteQuery}
                    selectedIndex={selectedIndex}
                    onSelect={handlePlanSelect}
                    onClose={() => setShowAutocomplete(false)}
                    position={autocompletePosition}
                />
            )}
        </div>
    );
}

