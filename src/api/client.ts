// Thin client for the APDA backend (server/). All calls go through /api (proxied
// by Vite in dev). Every screen using this must tolerate the backend being down —
// see src/store/backend.ts for the offline fallback.

import type { Scenario } from '@/types';

const BASE = (import.meta.env.VITE_API_URL as string | undefined) ?? '/api';

export interface CustomField {
  key: string;
  label: string;
  value: unknown;
  unit?: string;
  source?: string;
  sourceDocumentId?: string | null;
  confidence?: number | null;
  agent?: string;
  ts?: string;
}

export interface BackendProject {
  id: string;
  title: string;
  scenarioId: string | null;
  status: string;
  brief: unknown;
  hitl: Record<string, number>;
  concepts: unknown[];
  customFields: CustomField[];
  adtCount: number;
}

async function req<T>(path: string, init?: RequestInit): Promise<T> {
  const res = await fetch(BASE + path, {
    headers: { 'Content-Type': 'application/json' },
    ...init,
  });
  if (!res.ok) throw new Error(`HTTP ${res.status} on ${path}`);
  return (await res.json()) as T;
}

/** Scenario templates, served from the file-backed scenarios table. */
export function getScenarios(): Promise<Scenario[]> {
  return req<Scenario[]>('/scenarios');
}

export async function pingBackend(): Promise<boolean> {
  try {
    const res = await fetch(BASE + '/health');
    return res.ok;
  } catch {
    return false;
  }
}

export function createProject(scenarioId: string | null, brief?: unknown): Promise<BackendProject> {
  return req<BackendProject>('/projects', {
    method: 'POST',
    body: JSON.stringify({ scenarioId, brief }),
  });
}

export function retrieveFields(projectId: string): Promise<{ customFields: CustomField[] }> {
  return req<{ customFields: CustomField[] }>(`/projects/${projectId}/retrieve-fields`, {
    method: 'POST',
  });
}

export interface ConceptImage {
  id: string;
  conceptCode: string;
  iteration: number;
  prompt: string;
  kind: 'procedural' | 'ai';
  params: unknown;
  imageUrl: string | null;
  createdAt: string;
}

export function getConceptImages(projectId: string, code: string): Promise<ConceptImage[]> {
  return req<ConceptImage[]>(`/projects/${projectId}/concepts/${encodeURIComponent(code)}/images`);
}

export function postConceptImage(
  projectId: string,
  code: string,
  body: { prompt: string; params?: unknown; kind?: 'procedural' | 'ai'; imageUrl?: string },
): Promise<{ iteration: number; session: ConceptImage[] }> {
  return req<{ iteration: number; session: ConceptImage[] }>(
    `/projects/${projectId}/concepts/${encodeURIComponent(code)}/images`,
    { method: 'POST', body: JSON.stringify(body) },
  );
}

// A complete run snapshot sent to the backend to persist + archive on disk.
export interface ProjectSnapshot {
  scenarioName: string;
  brief: unknown;
  concepts: unknown[];
  customFields?: CustomField[];
  adt: unknown[];
  selectedConceptId: string | null;
  guidanceAnswers?: Record<string, string>;
  feedbackLoop?: unknown;
  runMode?: string;
}

export interface SaveProjectResult {
  id: string;
  dir: string;
  files: string[];
  savedAt: string;
}

/** Persist the full run and write its per-project archive folder. */
export function saveProject(projectId: string, snapshot: ProjectSnapshot): Promise<SaveProjectResult> {
  return req<SaveProjectResult>(`/projects/${projectId}/save`, {
    method: 'POST',
    body: JSON.stringify(snapshot),
  });
}

export interface ProjectListItem {
  id: string;
  title: string;
  scenarioId: string | null;
  status: string;
  createdAt: string;
  updatedAt: string;
  concepts: number;
  adt: number;
  images: number;
  saved: boolean;
}

export function listProjects(): Promise<ProjectListItem[]> {
  return req<ProjectListItem[]>('/projects');
}

export interface KnowledgeDoc {
  id: string;
  connector: string;
  source: string;
  title: string;
  body: string;
  confidence: number;
  ts: string;
}

export function getKnowledge(): Promise<KnowledgeDoc[]> {
  return req<KnowledgeDoc[]>('/knowledge');
}
