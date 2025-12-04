"use client";

import {
    forwardRef,
    useImperativeHandle,
    useRef,
    useState,
} from "react";
import type { ChatInterfaceProps, ChatInterfaceRef } from "./types";
import { useMessages, welcomeMessages } from "./hooks/use-messages";
import { usePlans, formatPlanDate } from "./hooks/use-plans";
import { useAgentExecution } from "./hooks/use-agent-execution";
import { useMdapExecution } from "./hooks/use-mdap-execution";
import { ChatHeader } from "./components/chat-header";
import { ChatInput } from "./components/chat-input";
import { ChatMessages } from "./components/chat-messages";
import { PlanList } from "./components/plan-list";
import { PlanDetailModal } from "./components/plan-detail-modal";
import { EmptyState } from "./components/empty-state";
import { QuickPrompts } from "./components/quick-prompts";
import { expandPlanMentions } from "./utils/plan-mentions";

export const ChatInterface = forwardRef<ChatInterfaceRef, ChatInterfaceProps>(
    ({
        activeProject,
        agentRef,
        isInitializing,
        onOpenKeyModal,
        onProjectChange,
        onUpdateProject,
        onStatusMessage,
        useMDAP = false,
        onNewPlan,
        onNewArtifacts,
        googleApiKey,
        selectedModel,
        plans: externalPlans = []
    }, ref) => {
        const [input, setInput] = useState("");
        const [isLoading, setIsLoading] = useState(false);
        const [showScreenshotTip, setShowScreenshotTip] = useState(false);

        const { messages, setMessages, scrollRef } = useMessages();
        const textareaRef = useRef<HTMLTextAreaElement>(null);

        const {
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
        } = usePlans({
            activeProject,
            externalPlans,
            onStatusMessage,
        });

        const { executeAgent } = useAgentExecution({
            agentRef,
            activeProject,
            messages,
            setMessages,
            setShowScreenshotTip,
            setIsLoading,
            onUpdateProject,
            onStatusMessage,
        });

        const { isMdapExecuting, mdapProgress, executeMdap, resetMdapProgress } = useMdapExecution({
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
            existingPlans: plans,
        });

        useImperativeHandle(ref, () => ({
            setInput: (value: string) => setInput(value),
            focusInput: () => textareaRef.current?.focus(),
        }));

        const handleNewChat = () => {
            if (agentRef.current && typeof agentRef.current.reset === "function") {
                agentRef.current.reset();
            }
            setMessages(welcomeMessages());
            setInput("");
            setShowScreenshotTip(false);
            resetMdapProgress(); // Clear MDAP progress when starting new chat
            onStatusMessage("Started a new chat.");
        };

        const handleSend = async () => {
            if (!input.trim() || isLoading) return;
            if (!agentRef.current) {
                onOpenKeyModal();
                return;
            }
            if (!activeProject) {
                return;
            }

            const userMessage = input.trim();
            
            // Expand plan mentions in the message
            const { expandedMessage, referencedPlans } = expandPlanMentions(
                userMessage,
                plans
            );
            
            // Show status if plans were referenced
            if (referencedPlans.length > 0) {
                onStatusMessage(
                    `Referencing ${referencedPlans.length} plan${referencedPlans.length > 1 ? "s" : ""}...`
                );
            }
            
            setInput("");
            setIsLoading(true);

            // MDAP execution path
            if (useMDAP && googleApiKey) {
                await executeMdap(expandedMessage, referencedPlans);
                return;
            }

            // Standard agent execution path
            await executeAgent(expandedMessage);
        };

        const canSend = !!activeProject && !isLoading && !isInitializing && Boolean(input.trim()) && !!agentRef.current;

        return (
            <div className="flex w-full flex-col border-r border-border bg-background lg:w-[420px]">
                <ChatHeader
                    plans={plans}
                    showPlans={showPlans}
                    onTogglePlans={() => setShowPlans(!showPlans)}
                    onNewChat={handleNewChat}
                />
                {showPlans && (
                    <PlanList
                        plans={plans}
                        selectedPlan={selectedPlan}
                        onSelectPlan={handlePlanSelect}
                        onDeletePlan={handleDeletePlan}
                        formatPlanDate={formatPlanDate}
                    />
                )}
                <div className="flex-1 flex flex-col overflow-hidden">
                    <div className="flex-1 space-y-2 overflow-y-auto px-4 py-3">
                        {!activeProject && <EmptyState />}
                        {messages.length <= 1 && !isLoading && (
                            <QuickPrompts onSelectPrompt={setInput} />
                        )}
                        <ChatMessages
                            messages={messages}
                            isLoading={isLoading}
                            isMdapExecuting={isMdapExecuting}
                            mdapProgress={mdapProgress}
                            isInitializing={isInitializing}
                            scrollRef={scrollRef}
                        />
                    </div>
                </div>
                <ChatInput
                    input={input}
                    setInput={setInput}
                    onSend={handleSend}
                    canSend={canSend}
                    showScreenshotTip={showScreenshotTip}
                    activeProject={!!activeProject}
                    isInitializing={isInitializing}
                    textareaRef={textareaRef}
                    plans={plans}
                />
                {showPlanDetail && selectedPlan && (
                    <PlanDetailModal
                        plan={selectedPlan}
                        onClose={() => {
                            setShowPlanDetail(false);
                            setSelectedPlan(null);
                        }}
                        formatPlanDate={formatPlanDate}
                    />
                )}
            </div>
        );
    }
);

ChatInterface.displayName = "ChatInterface";

// Re-export types for backward compatibility
export type { ChatInterfaceRef } from "./types";

