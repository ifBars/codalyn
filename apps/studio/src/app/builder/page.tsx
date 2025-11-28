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
import { ChevronDown, FileText, Sparkles } from "lucide-react";
import Preview from "@/components/work/preview";
import { SpinningLogo } from "@/components/landing/SpinningLogo";
import { ChatInterface, ChatInterfaceRef } from "@/components/builder/chat-interface";
import { PlansViewer } from "@/components/work/plans-viewer";
import { getPlansFromLocalStorage } from "@/lib/builder-mdap";
import type { Artifact } from "@codalyn/accuralai";

import {
  Agent,
  type AccuralAIModelId,
  DEFAULT_ACCURALAI_MODEL,
  ACCURALAI_MODEL_OPTIONS,
  CompositeToolSet,
  CodalynToolSet,
  BrowserToolSet,
  VectorStoreToolSet,
  Context7ToolSet,
  WebContainerSandbox,
  AccuralAIAdapter,
  ConversationMemory,
  getDefaultSystemPrompt,
} from "@/lib/ai";
import {
  StoredProject,
  clearStoredAccuralAIGoogleKey,
  clearStoredAccuralAIOpenRouterKey,
  clearStoredAccuralAIAnthropicKey,
  clearStoredContext7Key,
  getActiveProjectId,
  getProjectById,
  getPreferredAccuralAIModel,
  getStoredAccuralAIGoogleKey,
  getStoredAccuralAIOpenRouterKey,
  getStoredAccuralAIAnthropicKey,
  getStoredContext7Key,
  listProjects,
  markProjectOpened,
  setActiveProjectId,
  setPreferredAccuralAIModel,
  setStoredAccuralAIGoogleKey,
  setStoredContext7Key,
} from "@/lib/project-storage";
import { WebContainerManager } from "@/lib/webcontainer-manager";
import { LoadingScreen } from "@/components/ui/loading-screen";
import { VectorStore } from "@/lib/vector-store";

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

  const [googleApiKey, setGoogleApiKey] = useState("");
  const [openRouterApiKey, setOpenRouterApiKey] = useState("");
  const [anthropicApiKey, setAnthropicApiKey] = useState("");
  const [context7ApiKey, setContext7ApiKey] = useState("");
  const [apiKeyError, setApiKeyError] = useState<string | null>(null);
  const [context7ApiKeyError, setContext7ApiKeyError] = useState<string | null>(null);
  const [isAccuralAIReady, setIsAccuralAIReady] = useState(false);
  const [isCheckingKey, setIsCheckingKey] = useState(true);
  const [isKeyModalOpen, setIsKeyModalOpen] = useState(false);
  const [statusMessage, setStatusMessage] = useState<string | null>(null);
  const [availableProjects, setAvailableProjects] = useState<StoredProject[]>([]);
  const [projectId, setProjectId] = useState<string | null>(null);
  const [activeProject, setActiveProject] = useState<StoredProject | null>(null);
  const [projectError, setProjectError] = useState<string | null>(null);
  const [selectedModel, setSelectedModel] = useState<AccuralAIModelId>(
    DEFAULT_ACCURALAI_MODEL
  );
  const [isInitializing, setIsInitializing] = useState(true);
  const [useMDAP, setUseMDAP] = useState(false);
  const [plans, setPlans] = useState<Artifact[]>([]);
  const [currentPlan, setCurrentPlan] = useState<Artifact | null>(null);
  const [showPlans, setShowPlans] = useState(false);

  const agentRef = useRef<Agent | null>(null);
  const vectorStoreRef = useRef<VectorStore | null>(null);
  const chatInterfaceRef = useRef<ChatInterfaceRef>(null);

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
        setStatusMessage(error instanceof Error ? `Failed to initialize: ${error.message}` : "Failed to initialize WebContainer");
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

    // Load plans from localStorage
    const storedPlans = getPlansFromLocalStorage(projectId);
    setPlans(storedPlans);
    if (storedPlans.length > 0 && !currentPlan) {
      setCurrentPlan(storedPlans[0]);
    }
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
    const storedGoogle = getStoredAccuralAIGoogleKey();
    const storedContext7Key = getStoredContext7Key();
    const preferredModel = getPreferredAccuralAIModel();

    if (storedGoogle) {
      connectClient(
        {
          googleApiKey: storedGoogle || undefined,
          context7ApiKey: storedContext7Key || undefined,
        },
        preferredModel || DEFAULT_ACCURALAI_MODEL
      );
      setGoogleApiKey(storedGoogle || "");
    } else {
      setIsKeyModalOpen(true);
    }

    setIsCheckingKey(false);
  }, []);

  const connectClient = (
    apiKeys: {
      googleApiKey?: string;
      context7ApiKey?: string;
    },
    model: AccuralAIModelId
  ) => {
    const vectorStoreKey =
      apiKeys.googleApiKey || "local";

    if (!vectorStoreRef.current) {
      vectorStoreRef.current = new VectorStore(vectorStoreKey);
    }

    // Create sandbox
    const sandbox = new WebContainerSandbox();

    // Create tool sets
    const codalynTools = new CodalynToolSet(sandbox);
    const browserTools = new BrowserToolSet(); // Uses getGlobalIframe() internally
    const vectorStoreTools = new VectorStoreToolSet({
      vectorStore: vectorStoreRef.current,
    });

    // Add Context7 tools if API key is available
    const toolSets: any[] = [
      codalynTools,
      browserTools,
      vectorStoreTools,
    ];

    if (apiKeys.context7ApiKey) {
      const context7Tools = new Context7ToolSet({ apiKey: apiKeys.context7ApiKey });
      toolSets.push(context7Tools);
    }

    // Combine tool sets
    const compositeTools = new CompositeToolSet(toolSets);

    // Create memory with system prompt
    const memory = new ConversationMemory(getDefaultSystemPrompt());

    const adapter = new AccuralAIAdapter({
      googleApiKey: apiKeys.googleApiKey,
      modelName: model,
    });

    // Create agent
    agentRef.current = new Agent({
      modelAdapter: adapter,
      tools: compositeTools,
      memory,
      maxIterations: 20,
    });

    setIsAccuralAIReady(true);
  };

  // Sync project files to vector store when both are ready
  useEffect(() => {
    if (vectorStoreRef.current && activeProject && isAccuralAIReady) {
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
  }, [activeProject, isAccuralAIReady]);

  useEffect(() => {
    if (!statusMessage) return;
    const timeout = setTimeout(() => setStatusMessage(null), 4000);
    return () => clearTimeout(timeout);
  }, [statusMessage]);

  const handleApiKeySubmit = () => {
    const trimmedGoogle = googleApiKey.trim();
    const trimmedContext7 = context7ApiKey.trim();

    if (!trimmedGoogle) {
      setApiKeyError("Add a Google Gemini API key.");
      return;
    }

    if (trimmedGoogle) {
      setStoredAccuralAIGoogleKey(trimmedGoogle);
    } else {
      clearStoredAccuralAIGoogleKey();
    }

    if (trimmedContext7) {
      setStoredContext7Key(trimmedContext7);
    } else {
      clearStoredAccuralAIAnthropicKey();
    }

    const finalModel = selectedModel;

    connectClient(
      {
        googleApiKey: trimmedGoogle || undefined,
        context7ApiKey: trimmedContext7 || undefined,
      },
      finalModel
    );

    setIsKeyModalOpen(false);
    setApiKeyError(null);
    setContext7ApiKeyError(null);
    setStatusMessage("API keys saved privately in this browser.");
  };

  const handleClearApiKey = () => {
    clearStoredAccuralAIGoogleKey();
    clearStoredAccuralAIOpenRouterKey();
    clearStoredAccuralAIAnthropicKey();
    clearStoredContext7Key();
    agentRef.current = null;
    setIsAccuralAIReady(false);
    setIsKeyModalOpen(true);
    setGoogleApiKey("");
    setOpenRouterApiKey("");
    setAnthropicApiKey("");
    setContext7ApiKey("");
  };

  const handleModelChange = (nextModel: AccuralAIModelId) => {
    setSelectedModel(nextModel);
    setPreferredAccuralAIModel(nextModel);

    const storedGoogle = getStoredAccuralAIGoogleKey();
    const storedContext7Key = getStoredContext7Key();

    if (storedGoogle) {
      connectClient(
        {
          googleApiKey: storedGoogle || undefined,
          context7ApiKey: storedContext7Key || undefined,
        },
        nextModel
      );
      const label =
        ACCURALAI_MODEL_OPTIONS.find((option) => option.id === nextModel)?.label ?? nextModel;
      setStatusMessage(`${label} is ready for the next prompt.`);
    }
  };

  const handleRequestFix = (errorText: string) => {
    chatInterfaceRef.current?.setInput(errorText);
    chatInterfaceRef.current?.focusInput();
  };

  const handleProjectChange = (nextId: string) => {
    if (nextId === "__dashboard__") {
      router.push("/projects");
      return;
    }
    setProjectId(nextId);
    setActiveProjectId(nextId);
    router.replace(`/builder?projectId=${nextId}`);
  };

  const handleNewPlan = (plan: Artifact) => {
    setPlans((prev) => [plan, ...prev]);
    setCurrentPlan(plan);
    setShowPlans(true);
  };

  const handleNewArtifacts = (artifacts: Artifact[]) => {
    const planArtifacts = artifacts.filter((a) => a.type === "plan");
    if (planArtifacts.length > 0) {
      setPlans((prev) => [...planArtifacts, ...prev]);
      setCurrentPlan(planArtifacts[0]);
    }
  };

  const keyForm = (mode: "gate" | "modal") => (
    <div className="w-full max-w-md rounded-xl border border-border bg-card p-8 shadow-lg">
      <div className="flex items-center justify-between">
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.4em] text-primary">
            AI Backend access
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
        Your API keys stay inside this browser and never leave your device.
        Codalyn does not proxy or log any requests.
      </p>
      <form
        className="mt-6 space-y-4"
        onSubmit={(event: FormEvent) => {
          event.preventDefault();
          handleApiKeySubmit();
        }}
      >
        {apiKeyError && <p className="text-sm text-destructive">{apiKeyError}</p>}

        <div className="space-y-2">
          <label className="text-xs font-semibold uppercase tracking-[0.3em] text-muted-foreground">
            Google API key <span className="text-muted-foreground">(optional)</span>
          </label>
          <input
            type="password"
            value={googleApiKey}
            onChange={(event) => {
              setGoogleApiKey(event.target.value);
              setApiKeyError(null);
            }}
            placeholder="AIza..."
            className="w-full rounded-lg border border-border bg-input px-4 py-3 text-base text-foreground outline-none focus:border-primary focus:ring-2 focus:ring-primary/20"
          />
          <p className="text-xs text-muted-foreground">
            Required for google:* models (e.g., gemini-2.5). Get a key from{" "}
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

        <div className="space-y-2">
          <label className="text-xs font-semibold uppercase tracking-[0.3em] text-muted-foreground">
            Model
          </label>
          <select
            value={selectedModel}
            onChange={(event) => {
              handleModelChange(event.target.value as AccuralAIModelId);
            }}
            className="w-full rounded-lg border border-border bg-input px-4 py-3 text-base text-foreground outline-none focus:border-primary focus:ring-2 focus:ring-primary/20"
          >
            {ACCURALAI_MODEL_OPTIONS.map((option) => (
              <option key={option.id} value={option.id}>
                {option.label}
              </option>
            ))}
          </select>
        </div>

        <div className="space-y-2">
          <label className="text-xs font-semibold uppercase tracking-[0.3em] text-muted-foreground">
            Context7 API key <span className="text-muted-foreground">(optional)</span>
          </label>
          <input
            type="password"
            value={context7ApiKey}
            onChange={(event) => {
              setContext7ApiKey(event.target.value);
              setContext7ApiKeyError(null);
            }}
            placeholder="Enter your Context7 API key..."
            className="w-full rounded-lg border border-border bg-input px-4 py-3 text-base text-foreground outline-none focus:border-primary focus:ring-2 focus:ring-primary/20"
          />
          {context7ApiKeyError && <p className="text-sm text-destructive">{context7ApiKeyError}</p>}
          <p className="text-xs text-muted-foreground">
            Enable access to up-to-date library documentation. Get your key at {" "}
            <a
              href="https://context7.com/dashboard"
              target="_blank"
              rel="noreferrer"
              className="font-medium text-primary hover:underline"
            >
              Context7 Dashboard
            </a>
            .
          </p>
        </div>

        <button
          type="submit"
          className="flex w-full items-center justify-center rounded-lg bg-primary px-4 py-3 font-semibold text-primary-foreground transition hover:opacity-90"
        >
          Continue with AccuralAI
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

  if (!isAccuralAIReady) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background px-6 py-12">
        {keyForm("gate")}
      </div>
    );
  }

  if (isInitializing) {
    return <LoadingScreen message="Initializing workspace..." submessage="Setting up your development environment" />;
  }

  return (
    <div className="flex h-screen flex-col bg-background">
      <header className="flex items-center justify-between border-b border-border bg-background px-4 py-2">
        <div className="flex items-center gap-3">
          <Link href="/" className="flex items-center gap-2">
            <div className="flex h-12 w-12 items-center justify-center rounded-lg overflow-hidden">
              <SpinningLogo className="h-full w-full" />
            </div>
            <span className="text-sm font-semibold text-foreground">CODALYN Builder</span>
          </Link>
          <nav className="ml-4 flex items-center gap-1 text-xs text-muted-foreground">
            <Link href="/" className="rounded px-2 py-1 transition hover:bg-card hover:text-foreground">
              Landing
            </Link>
            <Link href="/projects" className="rounded px-2 py-1 transition hover:bg-card hover:text-foreground">
              Projects
            </Link>
            <Link href="/builder" className="rounded border border-primary/50 bg-primary/10 px-2 py-1 text-primary">
              Builder
            </Link>
          </nav>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={() => setUseMDAP(!useMDAP)}
            className={`flex items-center gap-1.5 rounded border px-3 py-1.5 text-xs font-medium transition ${useMDAP
                ? "border-primary bg-primary/10 text-primary"
                : "border-border bg-background text-muted-foreground hover:text-foreground"
              }`}
            title="Enable multi-agent MDAP orchestration"
          >
            <Sparkles className="h-3.5 w-3.5" />
            <span>MDAP</span>
          </button>
          <div className="relative">
            <select
              value={selectedModel}
              onChange={(event) =>
                handleModelChange(event.target.value as AccuralAIModelId)
              }
              className="w-40 appearance-none rounded border border-border bg-input px-3 py-1.5 pr-7 text-xs text-foreground focus:border-primary focus:outline-none"
            >
              {ACCURALAI_MODEL_OPTIONS.map((option) => (
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
              setGoogleApiKey(getStoredAccuralAIGoogleKey() ?? "");
              setOpenRouterApiKey(getStoredAccuralAIOpenRouterKey() ?? "");
              setAnthropicApiKey(getStoredAccuralAIAnthropicKey() ?? "");
              setContext7ApiKey(getStoredContext7Key() ?? "");
              setApiKeyError(null);
              setContext7ApiKeyError(null);
              setIsKeyModalOpen(true);
            }}
            className="text-xs text-primary transition hover:text-primary/80"
          >
            Manage API key
          </button>
          <Link
            href="/projects"
            className="rounded border border-primary/50 bg-primary/10 px-3 py-1.5 text-xs font-medium text-primary transition hover:bg-primary/20"
          >
            Open projects
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
        <ChatInterface
          ref={chatInterfaceRef}
          activeProject={activeProject}
          agentRef={agentRef}
          isInitializing={isInitializing}
          onOpenKeyModal={() => setIsKeyModalOpen(true)}
          onProjectChange={handleProjectChange}
          onUpdateProject={(updated) => {
            setActiveProject(updated);
            refreshProjects();
            // Update vector store with new project files for lazy indexing
            if (vectorStoreRef.current && typeof vectorStoreRef.current.setProjectFiles === 'function') {
              vectorStoreRef.current.setProjectFiles(updated.files);
            }
          }}
          onStatusMessage={setStatusMessage}
          useMDAP={useMDAP}
          onNewPlan={handleNewPlan}
          onNewArtifacts={handleNewArtifacts}
          googleApiKey={getStoredAccuralAIGoogleKey() || undefined}
          selectedModel={selectedModel}
        />

        {showPlans && plans.length > 0 ? (
          <div className="hidden flex-1 border-r border-border bg-background lg:flex flex-col">
            <div className="border-b border-border px-4 py-2 flex items-center justify-between">
              <div className="flex items-center gap-2">
                <FileText className="h-4 w-4 text-primary" />
                <span className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                  MDAP Plans
                </span>
                <span className="rounded-full bg-primary/20 px-2 py-0.5 text-xs text-primary">
                  {plans.length}
                </span>
              </div>
              <button
                onClick={() => setShowPlans(false)}
                className="text-xs text-muted-foreground hover:text-foreground"
              >
                Hide
              </button>
            </div>
            <PlansViewer
              plans={plans}
              currentPlan={currentPlan}
              onSelectPlan={setCurrentPlan}
            />
          </div>
        ) : (
          <div className="hidden flex-1 flex-col bg-background lg:flex">
            <Preview
              projectId={activeProject?.id || ""}
              onRequestFix={handleRequestFix}
            />
          </div>
        )}

        {/* Toggle button for Plans */}
        {plans.length > 0 && !showPlans && (
          <button
            onClick={() => setShowPlans(true)}
            className="absolute right-4 top-20 z-10 flex items-center gap-2 rounded-lg border border-primary/50 bg-primary/10 px-3 py-2 text-xs font-medium text-primary shadow-lg transition hover:bg-primary/20"
          >
            <FileText className="h-4 w-4" />
            <span>View Plans ({plans.length})</span>
          </button>
        )}
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
