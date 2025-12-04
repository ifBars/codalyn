"use client";

import { useTransition, useMemo, useCallback, useRef } from "react";
import type { Agent, AIMessage, FileOperation } from "@/lib/ai";
import { extractFileOperations, filterValidFileOperations } from "@/lib/ai";
import { convertAIMessagesToMessages } from "../utils/message-converter";
import { applyFileOperations } from "../utils/file-operations";
import type { StoredProject } from "@/lib/project-storage";

interface UseAgentExecutionParams {
    agentRef: React.MutableRefObject<Agent | null>;
    activeProject: StoredProject | null;
    messages: AIMessage[];
    setMessages: React.Dispatch<React.SetStateAction<AIMessage[]>>;
    setShowScreenshotTip: (show: boolean) => void;
    setIsLoading: (loading: boolean) => void;
    onUpdateProject: (project: StoredProject) => void;
    onStatusMessage: (message: string) => void;
}

export function useAgentExecution({
    agentRef,
    activeProject,
    messages,
    setMessages,
    setShowScreenshotTip,
    setIsLoading,
    onUpdateProject,
    onStatusMessage,
}: UseAgentExecutionParams) {
    const [isPending, startTransition] = useTransition();
    
    // Debounce state stored in refs to persist across renders
    const debounceTimeoutRef = useRef<NodeJS.Timeout | null>(null);
    const pendingUpdateRef = useRef<(() => void) | null>(null);
    
    // Debounce helper for rapid updates
    const debouncedUpdate = useCallback((updateFn: () => void, delay: number = 50) => {
        pendingUpdateRef.current = updateFn;
        
        if (debounceTimeoutRef.current) {
            clearTimeout(debounceTimeoutRef.current);
        }
        
        debounceTimeoutRef.current = setTimeout(() => {
            if (pendingUpdateRef.current) {
                startTransition(() => {
                    pendingUpdateRef.current!();
                });
                pendingUpdateRef.current = null;
            }
            debounceTimeoutRef.current = null;
        }, delay);
    }, [startTransition]);
    
    // Memoize expensive operations extraction
    const memoizedExtractOperations = useMemo(
        () => (toolCalls: any[], toolResults: any[]) => {
            return filterValidFileOperations(extractFileOperations(toolCalls, toolResults));
        },
        []
    );

    const executeAgent = async (userMessage: string) => {
        if (!agentRef.current || !activeProject) return;

        try {
            const userMsg: AIMessage = { role: "user", content: userMessage };
            const history = [...messages, userMsg];
            setMessages([...history, { role: "assistant", content: "" }]);

            agentRef.current.reset();
            const agentMemory = (agentRef.current as any).config.memory;
            const historyMessages = convertAIMessagesToMessages(messages);
            for (const msg of historyMessages) {
                agentMemory.addMessage(msg);
            }

            let fullResponse = "";
            let operations: FileOperation[] = [];
            let capturedScreenshot: string | undefined = undefined;
            const toolCalls: any[] = [];
            const toolResults: any[] = [];
            const allToolCalls: any[] = [];
            const allToolResults: any[] = [];
            let currentIteration = 0;
            let currentPhaseMessageIndex = history.length;

            const updateMessageWithOperations = () => {
                const currentOps = memoizedExtractOperations(toolCalls, toolResults);
                debouncedUpdate(() => {
                    setMessages((prev) => {
                        const next = [...prev];
                        if (currentPhaseMessageIndex >= 0 && currentPhaseMessageIndex < next.length) {
                            const phaseMsg = next[currentPhaseMessageIndex];
                            next[currentPhaseMessageIndex] = {
                                ...phaseMsg,
                                content: fullResponse,
                                screenshot: capturedScreenshot || phaseMsg.screenshot,
                                operations: currentOps.length > 0 ? currentOps : undefined,
                                toolCalls: toolCalls.length > 0 ? [...toolCalls] : undefined,
                                toolResults: toolResults.length > 0 ? [...toolResults] : undefined,
                            };
                        }
                        return next;
                    });
                }, 50); // Debounce rapid updates
            };
            
            const updateMessageContent = (newContent: string) => {
                debouncedUpdate(() => {
                    setMessages((prev) => {
                        const next = [...prev];
                        if (currentPhaseMessageIndex >= 0 && currentPhaseMessageIndex < next.length) {
                            const phaseMsg = next[currentPhaseMessageIndex];
                            next[currentPhaseMessageIndex] = {
                                ...phaseMsg,
                                content: newContent,
                                screenshot: capturedScreenshot || phaseMsg.screenshot,
                                operations: phaseMsg.operations,
                                toolCalls: phaseMsg.toolCalls,
                                toolResults: phaseMsg.toolResults,
                            };
                        }
                        return next;
                    });
                }, 16); // Faster updates for content (one frame at 60fps)
            };

            for await (const event of agentRef.current.runStream(userMessage)) {
                if (event.type === "iteration") {
                    const newIteration = event.iteration;
                    if (newIteration > currentIteration && currentIteration > 0) {
                        const previousPhaseOps = extractFileOperations(toolCalls, toolResults);
                        const validatedPreviousPhaseOps = filterValidFileOperations(previousPhaseOps);

                        setMessages((prev) => {
                            const next = [...prev];
                            if (currentPhaseMessageIndex >= 0 && currentPhaseMessageIndex < next.length) {
                                const phaseMsg = next[currentPhaseMessageIndex];
                                next[currentPhaseMessageIndex] = {
                                    ...phaseMsg,
                                    operations: validatedPreviousPhaseOps.length > 0 ? validatedPreviousPhaseOps : undefined,
                                    toolCalls: toolCalls.length > 0 ? [...toolCalls] : undefined,
                                    toolResults: toolResults.length > 0 ? [...toolResults] : undefined,
                                };
                            }
                            next.push({ role: "assistant", content: "" });
                            currentPhaseMessageIndex = next.length - 1;
                            return next;
                        });
                    } else {
                        setMessages((prev) => {
                            currentPhaseMessageIndex = prev.length - 1;
                            return prev;
                        });
                    }

                    currentIteration = newIteration;
                    fullResponse = "";
                    toolCalls.length = 0;
                    toolResults.length = 0;
                } else if (event.type === "thought") {
                    fullResponse += event.content;
                    updateMessageContent(fullResponse);
                } else if (event.type === "tool_call") {
                    toolCalls.push(event.toolCall);
                    allToolCalls.push(event.toolCall);
                    if (event.toolCall.name === "capture_screenshot") {
                        setShowScreenshotTip(true);
                    }
                    updateMessageWithOperations();
                } else if (event.type === "tool_result") {
                    toolResults.push(event.toolResult);
                    allToolResults.push(event.toolResult);
                    if (event.toolResult.name === "capture_screenshot" && event.toolResult.success) {
                        const screenshot = event.toolResult.result?.screenshot;
                        if (screenshot) {
                            capturedScreenshot = screenshot;
                            setShowScreenshotTip(false);
                            setMessages((prev) => {
                                const next = [...prev];
                                if (currentPhaseMessageIndex >= 0 && currentPhaseMessageIndex < next.length) {
                                    const phaseMsg = next[currentPhaseMessageIndex];
                                    next[currentPhaseMessageIndex] = {
                                        ...phaseMsg,
                                        screenshot,
                                        operations: phaseMsg.operations,
                                        toolCalls: phaseMsg.toolCalls,
                                        toolResults: phaseMsg.toolResults,
                                    };
                                }
                                return next;
                            });
                        }
                    }
                    updateMessageWithOperations();
                } else if (event.type === "response") {
                    fullResponse = event.content;
                    // For complete responses, update immediately without debouncing
                    startTransition(() => {
                        setMessages((prev) => {
                            const next = [...prev];
                            if (currentPhaseMessageIndex >= 0 && currentPhaseMessageIndex < next.length) {
                                const phaseMsg = next[currentPhaseMessageIndex];
                                next[currentPhaseMessageIndex] = {
                                    ...phaseMsg,
                                    content: fullResponse,
                                    screenshot: capturedScreenshot || phaseMsg.screenshot,
                                    operations: phaseMsg.operations,
                                    toolCalls: phaseMsg.toolCalls,
                                    toolResults: phaseMsg.toolResults,
                                };
                            }
                            return next;
                        });
                    });
                } else if (event.type === "error_check") {
                    // Show status message when checking for errors
                    if (event.checking) {
                        onStatusMessage("Checking for errors...");
                    } else {
                        onStatusMessage("");
                    }
                } else if (event.type === "errors_found") {
                    // Show status message about errors found
                    const errorCount = 
                        (event.errors.typeErrors?.length || 0) +
                        (event.errors.buildErrors?.length || 0) +
                        (event.errors.runtimeErrors?.length || 0);
                    onStatusMessage(`Found ${errorCount} error(s) - fixing automatically...`);
                } else if (event.type === "done") {
                    const validatedCurrentPhaseOps = memoizedExtractOperations(toolCalls, toolResults);

                    setMessages((prev) => {
                        const next = [...prev];
                        if (currentPhaseMessageIndex >= 0 && currentPhaseMessageIndex < next.length) {
                            const phaseMsg = next[currentPhaseMessageIndex];
                            next[currentPhaseMessageIndex] = {
                                ...phaseMsg,
                                operations: validatedCurrentPhaseOps.length > 0 ? validatedCurrentPhaseOps : undefined,
                                toolCalls: toolCalls.length > 0 ? [...toolCalls] : undefined,
                                toolResults: toolResults.length > 0 ? [...toolResults] : undefined,
                            };
                        }
                        return next;
                    });

                    operations = memoizedExtractOperations(allToolCalls, allToolResults);
                    onStatusMessage(""); // Clear status message
                }
            }

            if (operations.length > 0) {
                const updated = await applyFileOperations({
                    operations,
                    activeProject,
                    setMessages,
                });
                if (updated) {
                    onUpdateProject(updated);
                    onStatusMessage("Project saved to browser storage.");
                }
            }
        } catch (error) {
            console.error("Error sending prompt", error);
            setMessages((prev) => [
                ...prev,
                {
                    role: "assistant",
                    content:
                        error instanceof Error ? `Error: ${error.message}` : "Something went wrong.",
                },
            ]);
        } finally {
            setIsLoading(false);
        }
    };

    return {
        executeAgent,
    };
}

