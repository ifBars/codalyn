"use client";

import {
    forwardRef,
    useCallback,
    useEffect,
    useImperativeHandle,
    useRef,
    useState,
} from "react";
import Link from "next/link";
import { ArrowUp, FileCode, Loader2, ChevronDown, ChevronUp, Brain, ListChecks, Sparkles } from "lucide-react";
import { MarkdownContent } from "@/components/ui/markdown-content";
import {
    type Agent,
    type AIMessage,
    type FileOperation,
    type Message,
    extractFileOperations,
    filterValidFileOperations,
} from "@/lib/ai";
import {
    StoredProject,
    listProjects,
    getProjectById,
    markProjectOpened,
    applyFileOperationsToProject
} from "@/lib/project-storage";
import { WebContainerManager } from "@/lib/webcontainer-manager";
import { parseChatContent, ChatSection } from "@/lib/chat-parser";
import { executeMdapInBrowser, saveArtifactsToLocalStorage } from "@/lib/builder-mdap";
import { MdapProgress, type MdapProgressUpdate } from "./mdap-progress";

interface ChatInterfaceProps {
    activeProject: StoredProject | null;
    agentRef: React.MutableRefObject<Agent | null>;
    isInitializing: boolean;
    onOpenKeyModal: () => void;
    onProjectChange: (id: string) => void;
    onUpdateProject: (project: StoredProject) => void;
    onStatusMessage: (message: string) => void;
    useMDAP?: boolean;
    onNewPlan?: (plan: any) => void;
    onNewArtifacts?: (artifacts: any[]) => void;
    googleApiKey?: string;
    selectedModel?: string;
}

export interface ChatInterfaceRef {
    setInput: (value: string) => void;
    focusInput: () => void;
}

const welcomeMessages = (): AIMessage[] => [
    {
        role: "assistant",
        content:
            "👋 Hi! I'm your AI frontend developer. Tell me what you want to build and I'll help you build it.",
    },
];

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
        selectedModel
    }, ref) => {
        const [messages, setMessages] = useState<AIMessage[]>([]);
        const [input, setInput] = useState("");
        const [isLoading, setIsLoading] = useState(false);
        const [showScreenshotTip, setShowScreenshotTip] = useState(false);
        const [isMdapExecuting, setIsMdapExecuting] = useState(false);
        const [mdapProgress, setMdapProgress] = useState<MdapProgressUpdate | null>(null);

        const scrollRef = useRef<HTMLDivElement>(null);
        const textareaRef = useRef<HTMLTextAreaElement>(null);

        useImperativeHandle(ref, () => ({
            setInput: (value: string) => setInput(value),
            focusInput: () => textareaRef.current?.focus(),
        }));

        useEffect(() => {
            setMessages(welcomeMessages());
        }, []);

        useEffect(() => {
            if (scrollRef.current) {
                scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
            }
        }, [messages]);

        const handleNewChat = () => {
            if (agentRef.current && typeof agentRef.current.reset === "function") {
                agentRef.current.reset();
            }
            setMessages(welcomeMessages());
            setInput("");
            setShowScreenshotTip(false);
            onStatusMessage("Started a new chat.");
        };

        // Helper to convert AIMessage[] to Message[]
        const convertAIMessagesToMessages = (aiMessages: AIMessage[]): Message[] => {
            return aiMessages.map((msg) => {
                if (msg.role === "user") {
                    return {
                        role: "user",
                        content: msg.content,
                    };
                } else {
                    return {
                        role: "assistant",
                        content: msg.content,
                    };
                }
            });
        };

        const handleSend = async () => {
            if (!input.trim() || isLoading) return;
            if (!agentRef.current) {
                onOpenKeyModal();
                return;
            }
            if (!activeProject) {
                // Prompt to select project?
                // For now just return, UI should handle disabled state
                return;
            }

            const userMessage = input.trim();
            setInput("");
            setIsLoading(true);

            // MDAP execution path
            if (useMDAP && googleApiKey) {
                try {
                    const userMsg: AIMessage = { role: "user", content: userMessage };
                    setMessages((prev) => [...prev, userMsg, { role: "assistant", content: "" }]);
                    setIsMdapExecuting(true);
                    setMdapProgress({ stage: "planning", message: "Initializing MDAP orchestrator..." });

                    const result = await executeMdapInBrowser(userMessage, {
                        googleApiKey,
                        modelName: selectedModel,
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

                    // Display result
                    const responseText = result.finalOutput || "MDAP execution completed.";
                    setMessages((prev) => {
                        const next = [...prev];
                        next[next.length - 1] = {
                            ...next[next.length - 1],
                            content: responseText,
                        };
                        return next;
                    });

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
                } finally {
                    setIsLoading(false);
                    setIsMdapExecuting(false);
                    // Clear progress after a brief delay so users can see completion
                    setTimeout(() => setMdapProgress(null), 2000);
                }
                return;
            }

            // Standard agent execution path
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
                    const currentOps = extractFileOperations(toolCalls, toolResults);
                    setMessages((prev) => {
                        const next = [...prev];
                        if (currentPhaseMessageIndex >= 0 && currentPhaseMessageIndex < next.length) {
                            const phaseMsg = next[currentPhaseMessageIndex];
                            next[currentPhaseMessageIndex] = {
                                ...phaseMsg,
                                content: fullResponse,
                                screenshot: capturedScreenshot || phaseMsg.screenshot,
                                operations: currentOps.length > 0 ? currentOps : undefined,
                            };
                        }
                        return next;
                    });
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
                        setMessages((prev) => {
                            const next = [...prev];
                            if (currentPhaseMessageIndex >= 0 && currentPhaseMessageIndex < next.length) {
                                const phaseMsg = next[currentPhaseMessageIndex];
                                next[currentPhaseMessageIndex] = {
                                    ...phaseMsg,
                                    content: fullResponse,
                                    screenshot: capturedScreenshot || phaseMsg.screenshot,
                                    operations: phaseMsg.operations,
                                };
                            }
                            return next;
                        });
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
                                        };
                                    }
                                    return next;
                                });
                            }
                        }
                        updateMessageWithOperations();
                    } else if (event.type === "response") {
                        fullResponse = event.content;
                        setMessages((prev) => {
                            const next = [...prev];
                            if (currentPhaseMessageIndex >= 0 && currentPhaseMessageIndex < next.length) {
                                const phaseMsg = next[currentPhaseMessageIndex];
                                next[currentPhaseMessageIndex] = {
                                    ...phaseMsg,
                                    content: fullResponse,
                                    screenshot: capturedScreenshot || phaseMsg.screenshot,
                                    operations: phaseMsg.operations,
                                };
                            }
                            return next;
                        });
                    } else if (event.type === "done") {
                        const currentPhaseOps = extractFileOperations(toolCalls, toolResults);
                        const validatedCurrentPhaseOps = filterValidFileOperations(currentPhaseOps);

                        setMessages((prev) => {
                            const next = [...prev];
                            if (currentPhaseMessageIndex >= 0 && currentPhaseMessageIndex < next.length) {
                                const phaseMsg = next[currentPhaseMessageIndex];
                                next[currentPhaseMessageIndex] = {
                                    ...phaseMsg,
                                    operations: validatedCurrentPhaseOps.length > 0 ? validatedCurrentPhaseOps : undefined,
                                };
                            }
                            return next;
                        });

                        operations = filterValidFileOperations(extractFileOperations(allToolCalls, allToolResults));
                    }
                }

                if (operations.length > 0) {
                    const operationErrors: string[] = [];
                    const validOperations = operations;
                    let packageJsonUpdated = false;

                    for (const op of validOperations) {
                        try {
                            if (op.type === "install_package" && op.packages) {
                                try {
                                    const updatedPackageJson = await WebContainerManager.readFile("package.json");
                                    if (updatedPackageJson) {
                                        packageJsonUpdated = true;
                                        validOperations.push({
                                            type: "write",
                                            path: "package.json",
                                            content: updatedPackageJson,
                                        });
                                    }
                                } catch (readError) {
                                    console.warn(`Could not read package.json after installation:`, readError);
                                }
                                continue;
                            } else if (op.type === "write" && op.content && op.path) {
                                await WebContainerManager.writeFile(op.path, op.content);
                            } else if (op.type === "delete" && op.path) {
                                await WebContainerManager.rm(op.path);
                            }
                        } catch (error) {
                            const errorMsg = error instanceof Error ? error.message : String(error);
                            operationErrors.push(`Failed to ${op.type} ${op.path}: ${errorMsg}`);
                        }
                    }

                    if (operationErrors.length > 0) {
                        const errorSummary = `⚠ ${operationErrors.length} operation(s) failed:\n${operationErrors.map(err => `  • ${err}`).join('\n')}`;
                        setMessages((prev) => {
                            const next = [...prev];
                            const lastMsg = next[next.length - 1];
                            if (lastMsg) {
                                next[next.length - 1] = {
                                    ...lastMsg,
                                    content: lastMsg.content ? `${lastMsg.content}\n\n${errorSummary}` : errorSummary,
                                };
                            }
                            return next;
                        });
                    }

                    setMessages((prev) => {
                        const next = [...prev];
                        next[next.length - 1] = { ...next[next.length - 1], operations: validOperations };
                        return next;
                    });

                    const updated = applyFileOperationsToProject(activeProject.id, validOperations);
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

        const canSend = !!activeProject && !isLoading && !isInitializing && Boolean(input.trim()) && agentRef.current;

        return (
            <div className="flex w-full flex-col border-r border-border bg-background lg:w-[420px]">
                <div className="flex items-center justify-between border-b border-border px-4 py-2 text-[10px] uppercase tracking-wider text-muted-foreground">
                    <span>Chat</span>
                    <button
                        type="button"
                        onClick={handleNewChat}
                        className="rounded border border-border px-2 py-1 text-[11px] font-medium text-foreground transition hover:border-primary hover:text-primary"
                    >
                        New chat
                    </button>
                </div>
                <div ref={scrollRef} className="flex-1 space-y-2 overflow-y-auto px-4 py-3">
                    {isInitializing && (
                        <div className="flex items-center gap-2 rounded border border-border bg-card px-3 py-2 text-xs text-card-foreground">
                            <Loader2 className="h-3 w-3 animate-spin text-primary" />
                            <span>Provisioning WebContainer…</span>
                        </div>
                    )}

                    {!activeProject && (
                        <div className="rounded border border-dashed border-border bg-card px-4 py-4 text-xs text-card-foreground">
                            <p className="font-medium text-foreground">Projects stay on this device</p>
                            <p className="mt-1 text-muted-foreground">
                                Create a project from the dashboard to capture AI diffs, metadata, and source files.
                            </p>
                            <Link
                                href="/projects"
                                className="mt-3 inline-flex items-center gap-1.5 text-primary hover:text-primary/80"
                            >
                                <span>Open projects</span>
                                <ArrowUp className="h-3 w-3 rotate-45" />
                            </Link>
                        </div>
                    )}

                    {messages.length <= 1 && !isLoading && (
                        <div className="rounded border border-border bg-card p-3">
                            <p className="mb-2 text-[10px] uppercase tracking-wider text-muted-foreground">
                                Quick prompts
                            </p>
                            <div className="grid gap-1.5 sm:grid-cols-2">
                                {["Design a pricing page with plans", "Build me a beautiful developer portfolio", "Prototype a hero + FAQ section", "Add dark mode toggle"].map(
                                    (example) => (
                                        <button
                                            key={example}
                                            onClick={() => setInput(example)}
                                            className="rounded border border-border bg-input px-3 py-2 text-left text-xs text-foreground transition hover:border-primary/50 hover:bg-card"
                                        >
                                            {example}
                                        </button>
                                    )
                                )}
                            </div>
                        </div>
                    )}

                    {messages.map((msg, idx) => {
                        if (msg.role === "assistant" && !msg.content.trim() && (!msg.operations || msg.operations.length === 0) && !msg.screenshot) {
                            return null;
                        }
                        return (
                            <div
                                key={`${msg.role}-${idx}`}
                                className={`rounded px-3 py-2 text-xs leading-relaxed ${msg.role === "user"
                                    ? "bg-primary text-primary-foreground"
                                    : "bg-card text-card-foreground"
                                    }`}
                            >
                                {msg.screenshot && (
                                    <div className="mb-1.5 flex items-center gap-1.5 text-[10px] opacity-80">
                                        <FileCode className="h-3 w-3" />
                                        <span>Context attached</span>
                                    </div>
                                )}
                                {msg.role === "assistant" ? (
                                    <AssistantMessageContent content={msg.content} operations={msg.operations} />
                                ) : (
                                    <p className="whitespace-pre-wrap">{msg.content}</p>
                                )}
                            </div>
                        );
                    })}

                    {isLoading && isMdapExecuting && mdapProgress && (
                        <MdapProgress progress={mdapProgress} />
                    )}

                    {isLoading && !isMdapExecuting && (
                        <div className="flex items-center gap-2 rounded border border-border bg-card px-3 py-2 text-xs text-card-foreground">
                            <Loader2 className="h-3 w-3 animate-spin text-primary" />
                            <span>AI is working…</span>
                        </div>
                    )}
                </div>

                <div className="border-t border-border bg-background p-3 space-y-2">
                    {showScreenshotTip && (
                        <div className="rounded border border-primary/40 bg-primary/10 px-3 py-2">
                            <p className="text-[10px] text-primary">
                                💡 The AI is capturing a screenshot of the preview to see the current UI state.
                            </p>
                        </div>
                    )}

                    <div className="flex gap-2">
                        <textarea
                            ref={textareaRef}
                            value={input}
                            onChange={(event) => setInput(event.target.value)}
                            onKeyDown={(event) => {
                                if (event.key === "Enter" && !event.shiftKey) {
                                    event.preventDefault();
                                    handleSend();
                                }
                            }}
                            placeholder={activeProject ? "Describe what to build next…" : "Select a project first"}
                            disabled={!activeProject || isInitializing}
                            className="flex-1 resize-none rounded border border-border bg-input px-3 py-2 text-xs text-foreground placeholder-muted-foreground focus:border-primary focus:outline-none disabled:opacity-60"
                            rows={2}
                        />
                        <button
                            onClick={() => handleSend()}
                            disabled={!canSend}
                            className="rounded bg-primary p-2 text-primary-foreground transition hover:opacity-90 disabled:opacity-40"
                            title="Send message"
                        >
                            <ArrowUp className="h-4 w-4" />
                        </button>
                    </div>
                </div>
            </div>
        );
    }
);

ChatInterface.displayName = "ChatInterface";

function AssistantMessageContent({ content, operations }: { content: string; operations?: FileOperation[] }) {
    const sections = parseChatContent(content);

    // Filter out empty sections to prevent extra spacing
    const validSections = sections.filter(s => s.content.trim().length > 0);

    if (validSections.length === 0 && (!operations || operations.length === 0)) {
        return null;
    }

    return (
        <div className="space-y-2">
            {validSections.map((section, idx) => {
                if (section.type === 'thinking') {
                    return (
                        <CollapsibleSection key={idx} title="Thinking Process" icon={Brain} defaultOpen={false}>
                            <div className="whitespace-pre-wrap text-muted-foreground">{section.content}</div>
                        </CollapsibleSection>
                    );
                } else if (section.type === 'plan') {
                    return (
                        <CollapsibleSection key={idx} title="Plan" icon={ListChecks} defaultOpen={true}>
                            <div className="whitespace-pre-wrap">{section.content}</div>
                        </CollapsibleSection>
                    );
                } else {
                    return (
                        <MarkdownContent key={idx} content={section.content} operations={operations} />
                    );
                }
            })}
        </div>
    );
}

function CollapsibleSection({ title, icon: Icon, children, defaultOpen = false }: { title: string, icon: any, children: React.ReactNode, defaultOpen?: boolean }) {
    const [isOpen, setIsOpen] = useState(defaultOpen);

    return (
        <div className="rounded border border-border/50 bg-muted/20">
            <button
                onClick={() => setIsOpen(!isOpen)}
                className="flex w-full items-center justify-between px-3 py-2 text-xs font-medium text-muted-foreground hover:bg-muted/30 hover:text-foreground"
            >
                <div className="flex items-center gap-2">
                    <Icon className="h-3.5 w-3.5" />
                    <span>{title}</span>
                </div>
                {isOpen ? <ChevronUp className="h-3.5 w-3.5" /> : <ChevronDown className="h-3.5 w-3.5" />}
            </button>
            {isOpen && (
                <div className="border-t border-border/50 px-3 py-2 text-xs">
                    {children}
                </div>
            )}
        </div>
    );
}
