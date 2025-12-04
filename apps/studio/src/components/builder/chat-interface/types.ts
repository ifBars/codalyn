import type { Agent, AIMessage, AccuralAIModelId } from "@/lib/ai";
import type { StoredProject } from "@/lib/project-storage";
import type { Artifact } from "@codalyn/accuralai";

export interface ChatInterfaceProps {
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
    selectedModel?: AccuralAIModelId;
    plans?: Artifact[];
}

export interface ChatInterfaceRef {
    setInput: (value: string) => void;
    focusInput: () => void;
}

