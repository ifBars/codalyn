"use client";

import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import {
  FormEvent,
  useCallback,
  useEffect,
  useRef,
  useState,
} from "react";
import { ArrowUp, ChevronDown, FileCode, Loader2 } from "lucide-react";
import Preview from "@/components/work/preview";
import { MarkdownContent } from "@/components/ui/markdown-content";

import {
  Agent,
  type GeminiModelId,
  type AIMessage,
  type FileOperation,
  DEFAULT_GEMINI_MODEL,
  GEMINI_MODEL_OPTIONS,
  type Message,
  CompositeToolSet,
  CodalynToolSet,
  BrowserToolSet,
  VectorStoreToolSet,
  WebContainerSandbox,
  GeminiAdapter,
  ConversationMemory,
  getDefaultSystemPrompt,
  extractFileOperations,
  filterValidFileOperations,
} from "@/lib/ai";
import {
  StoredProject,
  applyFileOperationsToProject,
  clearStoredGeminiKey,
  getActiveProjectId,
  getProjectById,
  getPreferredGeminiModel,
  getStoredGeminiKey,
  listProjects,
  markProjectOpened,
  setActiveProjectId,
  setPreferredGeminiModel,
  setStoredGeminiKey,
} from "@/lib/project-storage";
import { WebContainerManager } from "@/lib/webcontainer-manager";
import { LoadingScreen } from "@/components/ui/loading-screen";
import { VectorStore } from "@/lib/vector-store";

const welcomeMessages = (): AIMessage[] => [
  {
    role: "assistant",
    content:
      "👋 Hi! I'm your AI frontend developer. Tell me what you want to build and I'll help you build it.",
  },
];

const formatTimestamp = (value?: string) => {
  if (!value) return "not yet";
  try {
    return new Intl.DateTimeFormat("en", {
      month: "short",
      day: "numeric",
      hour: "numeric",
      minute: "numeric",
    }).format(new Date(value));
  } catch {
    return "recently";
  }
};

const PROJECT_STORAGE_KEY = "codalyn.projects.v1";

export default function BuilderPage() {
  const router = useRouter();
  const searchParams = useSearchParams();

  const [messages, setMessages] = useState<AIMessage[]>([]);
  const [input, setInput] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [isInitializing, setIsInitializing] = useState(true);
  const [geminiApiKey, setGeminiApiKey] = useState("");
  const [apiKeyError, setApiKeyError] = useState<string | null>(null);
  const [isGeminiReady, setIsGeminiReady] = useState(false);
  const [isCheckingKey, setIsCheckingKey] = useState(true);
  const [isKeyModalOpen, setIsKeyModalOpen] = useState(false);
  const [statusMessage, setStatusMessage] = useState<string | null>(null);
  const [availableProjects, setAvailableProjects] = useState<StoredProject[]>([]);
  const [projectId, setProjectId] = useState<string | null>(null);
  const [activeProject, setActiveProject] = useState<StoredProject | null>(null);
  const [projectError, setProjectError] = useState<string | null>(null);
  const [selectedModel, setSelectedModel] = useState<GeminiModelId>(
    DEFAULT_GEMINI_MODEL
  );
  const [showScreenshotTip, setShowScreenshotTip] = useState(false);

  const agentRef = useRef<Agent | null>(null);
  const vectorStoreRef = useRef<VectorStore | null>(null);
  const scrollRef = useRef<HTMLDivElement>(null);

  const projectIdFromQuery = searchParams.get("projectId");

  const refreshProjects = useCallback(() => {
    setAvailableProjects(listProjects());
  }, []);

  useEffect(() => {
    refreshProjects();
    if (typeof window === "undefined") return;
    const handler = (event: StorageEvent) => {
      if (!event.key || event.key === PROJECT_STORAGE_KEY) {
        refreshProjects();
      }
    };
    window.addEventListener("storage", handler);
    return () => window.removeEventListener("storage", handler);
  }, [refreshProjects]);

  useEffect(() => {
    async function init() {
      try {
        // Ensure WebContainer is booted
        await WebContainerManager.getInstance();
      } catch (error) {
        console.error("Failed to initialize WebContainer", error);
        setMessages((prev) => [
          ...prev,
          {
            role: "assistant",
            content:
              error instanceof Error
                ? `Failed to initialize WebContainer: ${error.message}`
                : "Failed to initialize WebContainer.",
          },
        ]);
      } finally {
        setIsInitializing(false);
      }
    }

    init();
  }, []);

  useEffect(() => {
    if (!projectIdFromQuery) {
      const storedId = getActiveProjectId();
      if (storedId) {
        setProjectId(storedId);
        router.replace(`/builder?projectId=${storedId}`);
      }
      return;
    }

    setProjectId(projectIdFromQuery);
    setActiveProjectId(projectIdFromQuery);
  }, [projectIdFromQuery, router]);

  useEffect(() => {
    if (!projectId) {
      setActiveProject(null);
      setProjectError(
        "Choose a project from your dashboard to save every file locally."
      );
      return;
    }

    const hydrated = markProjectOpened(projectId) || getProjectById(projectId);
    if (!hydrated) {
      setActiveProject(null);
      setProjectError("We couldn't find that project in this browser.");
      return;
    }

    setProjectError(null);
    setActiveProject(hydrated);
  }, [projectId]);

  // Sync project files to vector store
  useEffect(() => {
    if (!activeProject || isInitializing) return;

    // Set project files in vector store for lazy indexing
    if (vectorStoreRef.current && typeof vectorStoreRef.current.setProjectFiles === 'function') {
      vectorStoreRef.current.setProjectFiles(activeProject.files);
    }
  }, [activeProject, isInitializing]);

  useEffect(() => {
    const preferredModel = getPreferredGeminiModel() ?? DEFAULT_GEMINI_MODEL;
    setSelectedModel(preferredModel);
    const storedKey = getStoredGeminiKey();
    if (storedKey) {
      connectGeminiClient(storedKey, preferredModel, true);
      setGeminiApiKey(storedKey);
    } else {
      setIsKeyModalOpen(true);
    }
    setIsCheckingKey(false);
  }, []);

  const connectGeminiClient = (
    apiKey: string,
    model: GeminiModelId,
    resetMessages = false
  ) => {
    // Initialize vector store if needed
    if (!vectorStoreRef.current) {
      vectorStoreRef.current = new VectorStore(apiKey);
    }

    // Create sandbox
    const sandbox = new WebContainerSandbox();

    // Create tool sets
    const codalynTools = new CodalynToolSet(sandbox);
    const browserTools = new BrowserToolSet(); // Uses getGlobalIframe() internally
    const vectorStoreTools = new VectorStoreToolSet({
      vectorStore: vectorStoreRef.current,
    });

    // Combine tool sets
    const compositeTools = new CompositeToolSet([
      codalynTools,
      browserTools,
      vectorStoreTools,
    ]);

    // Create memory with system prompt
    const memory = new ConversationMemory(getDefaultSystemPrompt());

    // Create adapter
    const adapter = new GeminiAdapter({
      apiKey,
      modelName: model,
    });

    // Create agent
    agentRef.current = new Agent({
      modelAdapter: adapter,
      tools: compositeTools,
      memory,
      maxIterations: 20,
    });

    setIsGeminiReady(true);
    if (resetMessages) {
      setMessages(welcomeMessages());
    }
  };

  // Sync project files to vector store when both are ready
  useEffect(() => {
    if (vectorStoreRef.current && activeProject && isGeminiReady) {
      try {
        vectorStoreRef.current.setProjectFiles(activeProject.files);
        // Update vector store tool set if agent exists
        if (agentRef.current) {
          const agent = agentRef.current as any;
          const compositeTools = agent.config.tools;
          if (compositeTools && compositeTools.toolSets) {
            for (const toolSet of compositeTools.toolSets) {
              if (toolSet instanceof VectorStoreToolSet) {
                toolSet.setVectorStore(vectorStoreRef.current);
              }
            }
          }
        }
      } catch (error) {
        console.warn("Failed to set project files in vector store:", error);
      }
    }
  }, [activeProject, isGeminiReady]);

  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [messages]);

  useEffect(() => {
    if (!statusMessage) return;
    const timeout = setTimeout(() => setStatusMessage(null), 4000);
    return () => clearTimeout(timeout);
  }, [statusMessage]);

  const handleApiKeySubmit = () => {
    const trimmed = geminiApiKey.trim();
    if (!trimmed) {
      setApiKeyError("Enter your Gemini API key to continue.");
      return;
    }
    if (!trimmed.startsWith("AI") && !trimmed.startsWith("AIza")) {
      setApiKeyError("That doesn't look like a Gemini API key.");
      return;
    }

    setStoredGeminiKey(trimmed);
    connectGeminiClient(trimmed, selectedModel, true);
    setIsKeyModalOpen(false);
    setApiKeyError(null);
    setStatusMessage("Gemini key saved privately in this browser.");
  };

  const handleClearApiKey = () => {
    clearStoredGeminiKey();
    agentRef.current = null;
    setIsGeminiReady(false);
    setIsKeyModalOpen(true);
    setGeminiApiKey("");
    setMessages([]);
  };

  const handleModelChange = (nextModel: GeminiModelId) => {
    setSelectedModel(nextModel);
    setPreferredGeminiModel(nextModel);
    const storedKey = getStoredGeminiKey();
    if (storedKey) {
      connectGeminiClient(storedKey, nextModel);
      const label =
        GEMINI_MODEL_OPTIONS.find((option) => option.id === nextModel)?.label ??
        nextModel;
      setStatusMessage(`${label} is ready for the next prompt.`);
    }
  };

  const handleRequestFix = (errorText: string) => {
    setInput(errorText);
    // Optional: Focus input
    const textarea = document.querySelector('textarea');
    if (textarea) {
      textarea.focus();
    }
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

  // Helper to convert Message[] to AIMessage[]
  const convertMessagesToAIMessages = (messages: Message[]): AIMessage[] => {
    return messages
      .filter((msg) => msg.role === "user" || msg.role === "assistant")
      .map((msg) => ({
        role: msg.role as "user" | "assistant",
        content: msg.content || "",
      }));
  };


  const handleSend = async () => {
    if (!input.trim() || isLoading) return;
    if (!agentRef.current) {
      setIsKeyModalOpen(true);
      return;
    }
    if (!activeProject) {
      setProjectError("Select a project from your dashboard before chatting.");
      return;
    }

    const userMessage = input.trim();
    setInput("");
    setIsLoading(true);

    try {
      const userMsg: AIMessage = { role: "user", content: userMessage };
      const history = [...messages, userMsg];
      setMessages([...history, { role: "assistant", content: "" }]);

      // Restore conversation history to agent memory
      // The agent's runStream will add the user message, so we restore previous messages only
      agentRef.current.reset();
      const agentMemory = (agentRef.current as any).config.memory;
      // Restore all previous messages (excluding the new user message which runStream will add)
      const historyMessages = convertAIMessagesToMessages(messages);
      for (const msg of historyMessages) {
        agentMemory.addMessage(msg);
      }

      let fullResponse = "";
      let operations: FileOperation[] = [];
      let capturedScreenshot: string | undefined = undefined;
      const toolCalls: any[] = [];
      const toolResults: any[] = [];

      // Process agent stream
      for await (const event of agentRef.current.runStream(userMessage)) {
        if (event.type === "thought") {
          fullResponse += event.content;
          setMessages((prev) => {
            const next = [...prev];
            const lastMsg = next[next.length - 1];
            if (lastMsg) {
              next[next.length - 1] = {
                ...lastMsg,
                content: fullResponse,
                screenshot: capturedScreenshot || lastMsg.screenshot,
              };
            }
            return next;
          });
        } else if (event.type === "tool_call") {
          toolCalls.push(event.toolCall);
          // Show tip when AI requests a screenshot
          if (event.toolCall.name === "capture_screenshot") {
            setShowScreenshotTip(true);
          }
        } else if (event.type === "tool_result") {
          toolResults.push(event.toolResult);
          
          // Handle screenshot capture
          if (event.toolResult.name === "capture_screenshot" && event.toolResult.success) {
            const screenshot = event.toolResult.result?.screenshot;
            if (screenshot) {
              capturedScreenshot = screenshot;
              setShowScreenshotTip(false);
              setMessages((prev) => {
                const next = [...prev];
                const lastMsg = next[next.length - 1];
                if (lastMsg) {
                  next[next.length - 1] = { ...lastMsg, screenshot };
                }
                return next;
              });
            }
          }
        } else if (event.type === "response") {
          fullResponse = event.content;
          setMessages((prev) => {
            const next = [...prev];
            const lastMsg = next[next.length - 1];
            if (lastMsg) {
              next[next.length - 1] = {
                ...lastMsg,
                content: fullResponse,
                screenshot: capturedScreenshot || lastMsg.screenshot,
              };
            }
            return next;
          });
        } else if (event.type === "done") {
          // Extract file operations from tool calls and results using improved parser
          const extractedOps = extractFileOperations(toolCalls, toolResults);
          operations = filterValidFileOperations(extractedOps);
        }
      }

      if (operations.length > 0) {
        const operationErrors: string[] = [];
        const successfulOps: string[] = [];

        // Operations are already validated by filterValidFileOperations
        const validOperations = operations;

        // Process operations, continuing even if some fail
        // Track if we need to save updated package.json
        let packageJsonUpdated = false;

        for (const op of validOperations) {
          try {
            if (op.type === "install_package" && op.packages) {
              const updatedPackageJson = await WebContainerManager.installPackage(op.packages);
              successfulOps.push(`Installed packages: ${op.packages.join(', ')}`);
              console.log(`✓ Installed packages: ${op.packages.join(', ')}`);
              if (updatedPackageJson) {
                packageJsonUpdated = true; // Mark that package.json was updated
                // Add package.json update to operations so it gets saved
                validOperations.push({
                  type: "write",
                  path: "package.json",
                  content: updatedPackageJson,
                });
                console.log(`✓ Added package.json update to operations`);
              }
            } else if (op.type === "write" && op.content && op.path) {
              await WebContainerManager.writeFile(op.path, op.content);

              // Update vector store with new file content
              if (vectorStoreRef.current) {
                try {
                  await vectorStoreRef.current.updateFile(op.path, op.content);
                } catch (error) {
                  console.warn(`Failed to update vector store for ${op.path}:`, error);
                }
              }

              successfulOps.push(`Created ${op.path}`);
              console.log(`✓ Wrote ${op.path}`);
            } else if (op.type === "delete" && op.path) {
              await WebContainerManager.rm(op.path);

              // Remove from vector store
              if (vectorStoreRef.current) {
                vectorStoreRef.current.removeFile(op.path);
              }

              successfulOps.push(`Deleted ${op.path}`);
              console.log(`✓ Deleted ${op.path}`);
            }
          } catch (error) {
            const errorMsg = error instanceof Error ? error.message : String(error);
            const operationDesc = op.type === "write" ? `write "${op.path}"` :
              op.type === "delete" ? `delete "${op.path}"` :
                `install packages ${op.packages?.join(', ')}`;
            operationErrors.push(`Failed to ${operationDesc}: ${errorMsg}`);
            console.error(`✗ Failed to ${operationDesc}`, error);
          }
        }

        // Only add error summary if there are failures (let AI provide human-readable success summary)
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

        // Note: package.json is now saved as part of validOperations when installPackage is called
        // No need to read it separately here

        // Save to project storage (only valid operations)
        const updated = applyFileOperationsToProject(activeProject.id, validOperations);
        if (updated) {
          setActiveProject(updated);
          refreshProjects();

          // Update vector store with new project files for lazy indexing
          if (vectorStoreRef.current && typeof vectorStoreRef.current.setProjectFiles === 'function') {
            vectorStoreRef.current.setProjectFiles(updated.files);
          }

          setStatusMessage("Project saved to browser storage.");
        }

        // Don't throw error - continue execution even if some operations failed
        // The errors are already logged and shown to the user
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

  const handleProjectChange = (nextId: string) => {
    if (nextId === "__dashboard__") {
      router.push("/dashboard");
      return;
    }
    setProjectId(nextId);
    setActiveProjectId(nextId);
    router.replace(`/builder?projectId=${nextId}`);
  };

  const keyForm = (mode: "gate" | "modal") => (
    <div className="w-full max-w-md rounded-xl border border-border bg-card p-8 shadow-lg">
      <div className="flex items-center justify-between">
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.4em] text-primary">
            Gemini access
          </p>
          <h1 className="mt-2 text-3xl font-semibold text-card-foreground">Bring your own API key</h1>
        </div>
        {mode === "modal" && (
          <button
            type="button"
            onClick={() => setIsKeyModalOpen(false)}
            className="text-sm text-muted-foreground transition hover:text-foreground"
          >
            Close
          </button>
        )}
      </div>
      <p className="mt-4 text-sm text-muted-foreground">
        Your Gemini key stays inside this browser and never leaves your device.
        Codalyn does not proxy or log any requests.
      </p>
      <form
        className="mt-6 space-y-4"
        onSubmit={(event: FormEvent) => {
          event.preventDefault();
          handleApiKeySubmit();
        }}
      >
        <div className="space-y-2">
          <label className="text-xs font-semibold uppercase tracking-[0.3em] text-muted-foreground">
            Gemini API key
          </label>
          <input
            type="password"
            value={geminiApiKey}
            onChange={(event) => {
              setGeminiApiKey(event.target.value);
              setApiKeyError(null);
            }}
            placeholder="AIza..."
            className="w-full rounded-lg border border-border bg-input px-4 py-3 text-base text-foreground outline-none focus:border-primary focus:ring-2 focus:ring-primary/20"
          />
          {apiKeyError && <p className="text-sm text-destructive">{apiKeyError}</p>}
          <p className="text-xs text-muted-foreground">
            Grab a key in seconds at {" "}
            <a
              href="https://makersuite.google.com/app/apikey"
              target="_blank"
              rel="noreferrer"
              className="font-medium text-primary hover:underline"
            >
              Google AI Studio
            </a>
            .
          </p>
        </div>

        <button
          type="submit"
          className="flex w-full items-center justify-center rounded-lg bg-primary px-4 py-3 font-semibold text-primary-foreground transition hover:opacity-90"
        >
          Continue with Gemini
        </button>

        {mode === "modal" && (
          <div className="flex flex-col gap-3 text-sm text-muted-foreground">
            <button
              type="button"
              onClick={handleClearApiKey}
              className="rounded-lg border border-border px-4 py-2 text-left transition hover:border-destructive/50 hover:text-destructive"
            >
              Remove saved key
            </button>
            <p className="text-xs text-muted-foreground">
              Removing your key means you will reconnect before running the builder
              again.
            </p>
          </div>
        )}
      </form>
    </div>
  );

  if (isCheckingKey) {
    return <LoadingScreen message="Checking API key..." />;
  }

  if (!isGeminiReady) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background px-6 py-12">
        {keyForm("gate")}
      </div>
    );
  }

  if (isInitializing) {
    return <LoadingScreen message="Initializing workspace..." submessage="Setting up your development environment" />;
  }

  const canSend =
    !!activeProject &&
    !isLoading &&
    !isInitializing &&
    Boolean(input.trim()) &&
    agentRef.current;

  return (
    <div className="flex h-screen flex-col bg-background">
      <header className="flex items-center justify-between border-b border-border bg-background px-4 py-2">
        <div className="flex items-center gap-3">
          <Link href="/" className="flex items-center gap-2">
            <div className="flex h-8 w-8 items-center justify-center rounded-lg overflow-hidden">
              <img src="/logo.png" alt="Codalyn" className="h-24 w-24 object-contain p-1" />
            </div>
            <span className="text-sm font-semibold text-foreground">CODALYN Builder</span>
          </Link>
          <nav className="ml-4 flex items-center gap-1 text-xs text-muted-foreground">
            <Link href="/" className="rounded px-2 py-1 transition hover:bg-card hover:text-foreground">
              Landing
            </Link>
            <Link href="/dashboard" className="rounded px-2 py-1 transition hover:bg-card hover:text-foreground">
              Dashboard
            </Link>
            <Link href="/builder" className="rounded border border-primary/50 bg-primary/10 px-2 py-1 text-primary">
              Builder
            </Link>
          </nav>
        </div>
        <div className="flex items-center gap-2">
          <div className="relative">
            <select
              value={selectedModel}
              onChange={(event) =>
                handleModelChange(event.target.value as GeminiModelId)
              }
              className="w-40 appearance-none rounded border border-border bg-input px-3 py-1.5 pr-7 text-xs text-foreground focus:border-primary focus:outline-none"
            >
              {GEMINI_MODEL_OPTIONS.map((option) => (
                <option key={option.id} value={option.id}>
                  {option.label}
                </option>
              ))}
            </select>
            <ChevronDown className="pointer-events-none absolute right-2 top-1/2 h-3 w-3 -translate-y-1/2 text-muted-foreground" />
          </div>
          <div className="flex items-center gap-1.5 rounded border border-border bg-card px-2 py-1 text-[10px] text-muted-foreground">
            <ShieldIcon />
            <span>Key stored locally</span>
          </div>
          <button
            onClick={() => {
              setGeminiApiKey(getStoredGeminiKey() ?? "");
              setApiKeyError(null);
              setIsKeyModalOpen(true);
            }}
            className="text-xs text-primary transition hover:text-primary/80"
          >
            Manage API key
          </button>
          <Link
            href="/dashboard"
            className="rounded border border-primary/50 bg-primary/10 px-3 py-1.5 text-xs font-medium text-primary transition hover:bg-primary/20"
          >
            Open dashboard
          </Link>
        </div>
      </header>

      <section className="flex items-center justify-between border-b border-border bg-background px-4 py-2">
        <div className="flex items-center gap-3">
          <span className="text-[10px] uppercase tracking-wider text-muted-foreground">Project</span>
          {activeProject ? (
            <div className="flex items-center gap-2">
              <span className="text-sm font-medium text-foreground">{activeProject.name}</span>
              <span className="text-xs text-muted-foreground">
                Updated {formatTimestamp(activeProject.updatedAt)}
              </span>
            </div>
          ) : (
            <span className="text-xs text-muted-foreground">No project selected.</span>
          )}
        </div>
        <div className="flex items-center gap-2">
          <div className="relative">
            <select
              value={projectId ?? ""}
              onChange={(event) => handleProjectChange(event.target.value)}
              className="w-40 appearance-none rounded border border-border bg-input px-3 py-1.5 pr-7 text-xs text-foreground focus:border-primary focus:outline-none"
            >
              <option value="" disabled>
                Select project
              </option>
              {availableProjects.map((project) => (
                <option key={project.id} value={project.id}>
                  {project.name}
                </option>
              ))}
              <option value="__dashboard__">+ Create new project</option>
            </select>
            <ChevronDown className="pointer-events-none absolute right-2 top-1/2 h-3 w-3 -translate-y-1/2 text-muted-foreground" />
          </div>
          {statusMessage && (
            <p className="text-xs text-success">{statusMessage}</p>
          )}
        </div>
        {projectError && (
          <p className="absolute right-4 top-full mt-1 text-xs text-destructive">{projectError}</p>
        )}
      </section>

      <div className="flex flex-1 overflow-hidden">
        <div className="flex w-full flex-col border-r border-border bg-background lg:w-[420px]">
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
                  href="/dashboard"
                  className="mt-3 inline-flex items-center gap-1.5 text-primary hover:text-primary/80"
                >
                  <span>Open dashboard</span>
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
                  {["Design a pricing page with plans", "Generate a CRM dashboard", "Prototype a hero + FAQ section", "Add dark mode toggle"].map(
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

            {messages.map((msg, idx) => (
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
                  <MarkdownContent content={msg.content} />
                ) : (
                  <p className="whitespace-pre-wrap">{msg.content}</p>
                )}
                {msg.operations && msg.operations.length > 0 && (
                  <div className="mt-2 space-y-0.5 rounded bg-background/50 p-2 text-[10px]">
                    <div className="font-medium opacity-70">
                      {msg.operations.length} file operation{msg.operations.length !== 1 ? "s" : ""}:
                    </div>
                    {msg.operations.map((op, i) => (
                      <div key={i} className="opacity-60">
                        • {op.type === "install_package"
                          ? `install ${op.packages?.join(', ')}`
                          : `${op.type} ${op.path}`}
                      </div>
                    ))}
                  </div>
                )}
              </div>
            ))}

            {isLoading && (
              <div className="flex items-center gap-2 rounded border border-border bg-card px-3 py-2 text-xs text-card-foreground">
                <Loader2 className="h-3 w-3 animate-spin text-primary" />
                <span>AI is thinking…</span>
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
                title="Send message (AI can capture screenshots automatically when needed)"
              >
                <ArrowUp className="h-4 w-4" />
              </button>
            </div>
          </div>
        </div>

        <div className="hidden flex-1 flex-col bg-background lg:flex">
          <Preview
            projectId={activeProject?.id || ""}
            onRequestFix={handleRequestFix}
          />
        </div>
      </div>

      {isKeyModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-background/80 backdrop-blur-sm px-4">
          {keyForm("modal")}
        </div>
      )}
    </div>
  );
}

function ShieldIcon() {
  return (
    <svg
      viewBox="0 0 24 24"
      aria-hidden
      className="h-4 w-4 text-success"
      fill="none"
      stroke="currentColor"
      strokeWidth={1.5}
    >
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        d="M12 3 4.5 6v6c0 4.28 2.99 8.24 7.5 9 4.51-.76 7.5-4.72 7.5-9V6L12 3Z"
      />
      <path strokeLinecap="round" strokeLinejoin="round" d="m9 12 2 2 4-4" />
    </svg>
  );
}
