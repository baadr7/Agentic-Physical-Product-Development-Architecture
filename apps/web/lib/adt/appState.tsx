'use client';

import React, { createContext, useCallback, useContext, useEffect, useRef, useState } from 'react';
import type { AgentLevels, DfxPriorities } from '~/lib/adt/config';
import { SCENARIOS } from '~/lib/adt/config';

// ── AppState shape ────────────────────────────────────────
export interface AdtAppState {
  brief?: Record<string, unknown>;
  scenarioId: string;
  projectId: string;
  runId: string;
  variantId: string;
  dfxPriorities: DfxPriorities;
  agentLevels: AgentLevels;
  feedbackLoopTriggered: boolean;
  selectedConceptId: string; // 'A' | 'B' | 'C' | 'D' for DN100
}

const DEFAULT_STATE: AdtAppState = {
  scenarioId: 'S2',
  projectId: '',
  runId: '',
  variantId: '',
  dfxPriorities: { dfm: 3, dfa: 2, dfr: 3, dfc: 3, dfs: 2 },
  agentLevels: { orchestrator: 3, retrieval: 4, generation: 2, simulation: 3, dfx: 3, documentation: 4 },
  feedbackLoopTriggered: false,
  selectedConceptId: '',
};

const STORAGE_KEY = 'adt_app_state_v1';

function load(): AdtAppState {
  if (typeof window === 'undefined') return DEFAULT_STATE;
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return DEFAULT_STATE;
    return { ...DEFAULT_STATE, ...JSON.parse(raw) };
  } catch {
    return DEFAULT_STATE;
  }
}

function save(s: AdtAppState) {
  if (typeof window === 'undefined') return;
  try { localStorage.setItem(STORAGE_KEY, JSON.stringify(s)); } catch { /* noop */ }
}

// ── Context ───────────────────────────────────────────────
interface AdtCtx {
  state: AdtAppState;
  setScenario: (id: string) => void;
  setProjectRun: (projectId: string, runId: string) => void;
  setVariant: (variantId: string) => void;
  setDfxPriorities: (p: DfxPriorities) => void;
  setAgentLevels: (l: AgentLevels) => void;
  setFeedbackLoop: (v: boolean) => void;
  setSelectedConcept: (id: string) => void;
  reset: () => void;
  // Derived
  humanRole: string;
  scenarioName: string;
}

const AdtContext = createContext<AdtCtx | null>(null);

export function AdtStateProvider({ children }: { children: React.ReactNode }) {
  const [state, setState] = useState<AdtAppState>(DEFAULT_STATE);
  const hydrated = useRef(false);

  // Hydrate from localStorage on mount
  useEffect(() => {
    if (!hydrated.current) {
      hydrated.current = true;
      setState(load());
    }
  }, []);

  const update = useCallback((patch: Partial<AdtAppState>) => {
    setState(prev => {
      const next = { ...prev, ...patch };
      save(next);
      return next;
    });
  }, []);

  const setScenario = useCallback((id: string) => {
    const sc = SCENARIOS.find(s => s.id === id);
    if (!sc) return;
    update({
      scenarioId: id,
      dfxPriorities: { ...sc.dfxPriorities },
      agentLevels: { ...sc.agentLevels },
    });
  }, [update]);

  const setProjectRun = useCallback((projectId: string, runId: string) => update({ projectId, runId }), [update]);
  const setVariant = useCallback((variantId: string) => update({ variantId }), [update]);
  const setDfxPriorities = useCallback((p: DfxPriorities) => update({ dfxPriorities: p }), [update]);
  const setAgentLevels = useCallback((l: AgentLevels) => update({ agentLevels: l }), [update]);
  const setFeedbackLoop = useCallback((v: boolean) => update({ feedbackLoopTriggered: v }), [update]);
  const setSelectedConcept = useCallback((id: string) => update({ selectedConceptId: id }), [update]);
  const reset = useCallback(() => { save(DEFAULT_STATE); setState(DEFAULT_STATE); }, []);

  const scenario = SCENARIOS.find(s => s.id === state.scenarioId);
  const orchLevel = state.agentLevels.orchestrator;
  const roleMap: Record<number, string> = { 1: 'Opérateur', 2: 'Collaborateur', 3: 'Décideur', 4: 'Approbateur', 5: 'Observateur' };

  return (
    <AdtContext.Provider value={{
      state,
      setScenario, setProjectRun, setVariant, setDfxPriorities,
      setAgentLevels, setFeedbackLoop, setSelectedConcept, reset,
      humanRole: roleMap[orchLevel] ?? 'Décideur',
      scenarioName: scenario?.name ?? 'S2 Industriel',
    }}>
      {children}
    </AdtContext.Provider>
  );
}

export function useAdtState(): AdtCtx {
  const ctx = useContext(AdtContext);
  if (!ctx) throw new Error('useAdtState must be used within AdtStateProvider');
  return ctx;
}
