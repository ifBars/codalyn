"use client";

import type { FileOperation, AccuralAIModelId } from "./ai";
import { defaultProjectFileMap } from "./project-template";

const PROJECTS_KEY = "codalyn.projects.v1";
const CONTEXT7_KEY = "codalyn.context7Key.v1";
const ACTIVE_PROJECT_KEY = "codalyn.activeProject.v1";
const ACCURALAI_GOOGLE_KEY = "codalyn.accuralai.googleKey.v1";
const ACCURALAI_OPENROUTER_KEY = "codalyn.accuralai.openrouterKey.v1";
const ACCURALAI_ANTHROPIC_KEY = "codalyn.accuralai.anthropicKey.v1";
const ACCURALAI_MODEL_KEY = "codalyn.accuralai.model.v1";

export interface StoredProject {
  id: string;
  name: string;
  description?: string;
  instructions?: string;
  createdAt: string;
  updatedAt: string;
  lastOpenedAt: string;
  files: Record<string, string>;
}

const isBrowser = () => typeof window !== "undefined";

const readStorage = <T>(key: string, fallback: T): T => {
  if (!isBrowser()) return fallback;
  try {
    const raw = window.localStorage.getItem(key);
    if (!raw) return fallback;
    return JSON.parse(raw) as T;
  } catch (error) {
    console.warn(`Failed to parse localStorage key "${key}"`, error);
    return fallback;
  }
};

const writeStorage = <T>(key: string, value: T) => {
  if (!isBrowser()) return;
  window.localStorage.setItem(key, JSON.stringify(value));
};

const removeStorage = (key: string) => {
  if (!isBrowser()) return;
  window.localStorage.removeItem(key);
};

const cloneFiles = (files: Record<string, string>) => ({ ...files });

// Deep clone a project to prevent reference sharing issues
const cloneProject = (project: StoredProject): StoredProject => ({
  ...project,
  files: { ...project.files },
});

export const listProjects = (): StoredProject[] => {
  const projects = readStorage<StoredProject[]>(PROJECTS_KEY, []);
  return projects.map(cloneProject).sort((a, b) =>
    new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime()
  );
};

const persistProjects = (projects: StoredProject[]) => {
  writeStorage(PROJECTS_KEY, projects);
};

export const getProjectById = (id: string): StoredProject | null => {
  const projects = readStorage<StoredProject[]>(PROJECTS_KEY, []);
  const project = projects.find((project) => project.id === id);
  return project ? cloneProject(project) : null;
};

export const setActiveProjectId = (id: string | null) => {
  if (!id) {
    removeStorage(ACTIVE_PROJECT_KEY);
    return;
  }
  writeStorage(ACTIVE_PROJECT_KEY, id);
};

export const getActiveProjectId = (): string | null => {
  return readStorage<string | null>(ACTIVE_PROJECT_KEY, null);
};

export const createProject = (input: {
  name: string;
  description?: string;
  instructions?: string;
}): StoredProject => {
  const now = new Date().toISOString();
  const project: StoredProject = {
    id: crypto?.randomUUID ? crypto.randomUUID() : `proj_${Date.now()}`,
    name: input.name.trim(),
    description: input.description?.trim() || undefined,
    instructions: input.instructions?.trim() || undefined,
    createdAt: now,
    updatedAt: now,
    lastOpenedAt: now,
    files: cloneFiles(defaultProjectFileMap),
  };

  const projects = readStorage<StoredProject[]>(PROJECTS_KEY, []);
  projects.unshift(project);
  persistProjects(projects);
  setActiveProjectId(project.id);
  return cloneProject(project);
};

export const updateProject = (
  id: string,
  updates: Partial<Pick<StoredProject, "name" | "description" | "instructions">>
): StoredProject | null => {
  const projects = readStorage<StoredProject[]>(PROJECTS_KEY, []);
  const index = projects.findIndex((project) => project.id === id);
  if (index === -1) return null;

  const now = new Date().toISOString();
  const updated: StoredProject = {
    ...projects[index],
    ...updates,
    updatedAt: now,
  };
  projects[index] = updated;
  persistProjects(projects);
  return cloneProject(updated);
};

export const deleteProject = (id: string) => {
  const projects = readStorage<StoredProject[]>(PROJECTS_KEY, []);
  const filtered = projects.filter((project) => project.id !== id);
  persistProjects(filtered);
  const activeId = getActiveProjectId();
  if (activeId === id) {
    setActiveProjectId(filtered[0]?.id ?? null);
  }
};

export const markProjectOpened = (id: string): StoredProject | null => {
  const projects = readStorage<StoredProject[]>(PROJECTS_KEY, []);
  const index = projects.findIndex((project) => project.id === id);
  if (index === -1) return null;

  const now = new Date().toISOString();
  const updated: StoredProject = {
    ...projects[index],
    lastOpenedAt: now,
  };
  projects[index] = updated;
  persistProjects(projects);
  setActiveProjectId(id);
  return cloneProject(updated);
};

export const applyFileOperationsToProject = (
  id: string,
  operations: FileOperation[]
): StoredProject | null => {
  if (operations.length === 0) return getProjectById(id);

  const projects = readStorage<StoredProject[]>(PROJECTS_KEY, []);
  const index = projects.findIndex((project) => project.id === id);
  if (index === -1) return null;

  // Create a deep copy to avoid mutating the original
  const project = cloneProject(projects[index]);
  let changed = false;

  for (const operation of operations) {
    if (operation.type === "write" && operation.content && operation.path) {
      project.files[operation.path] = operation.content;
      changed = true;
    } else if (operation.type === "delete" && operation.path) {
      if (project.files[operation.path]) {
        delete project.files[operation.path];
        changed = true;
      }
    }
  }

  if (!changed) return project;

  project.updatedAt = new Date().toISOString();
  projects[index] = project;
  persistProjects(projects);
  return cloneProject(project);
};

export const getStoredAccuralAIGoogleKey = (): string | null => {
  return readStorage<string | null>(ACCURALAI_GOOGLE_KEY, null);
};

export const setStoredAccuralAIGoogleKey = (apiKey: string) => {
  writeStorage(ACCURALAI_GOOGLE_KEY, apiKey);
};

export const clearStoredAccuralAIGoogleKey = () => {
  removeStorage(ACCURALAI_GOOGLE_KEY);
};

export const getStoredAccuralAIOpenRouterKey = (): string | null => {
  return readStorage<string | null>(ACCURALAI_OPENROUTER_KEY, null);
};

export const setStoredAccuralAIOpenRouterKey = (apiKey: string) => {
  writeStorage(ACCURALAI_OPENROUTER_KEY, apiKey);
};

export const clearStoredAccuralAIOpenRouterKey = () => {
  removeStorage(ACCURALAI_OPENROUTER_KEY);
};

export const getStoredAccuralAIAnthropicKey = (): string | null => {
  return readStorage<string | null>(ACCURALAI_ANTHROPIC_KEY, null);
};

export const setStoredAccuralAIAnthropicKey = (apiKey: string) => {
  writeStorage(ACCURALAI_ANTHROPIC_KEY, apiKey);
};

export const clearStoredAccuralAIAnthropicKey = () => {
  removeStorage(ACCURALAI_ANTHROPIC_KEY);
};

export const getPreferredAccuralAIModel = (): AccuralAIModelId | null => {
  return readStorage<AccuralAIModelId | null>(ACCURALAI_MODEL_KEY, null);
};

export const setPreferredAccuralAIModel = (model: AccuralAIModelId) => {
  writeStorage(ACCURALAI_MODEL_KEY, model);
};

export const getStoredContext7Key = (): string | null => {
  return readStorage<string | null>(CONTEXT7_KEY, null);
};

export const setStoredContext7Key = (apiKey: string) => {
  writeStorage(CONTEXT7_KEY, apiKey);
};

export const clearStoredContext7Key = () => {
  removeStorage(CONTEXT7_KEY);
};
