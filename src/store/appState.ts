import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';
import type {
  ScenarioKey,
  ProductBrief,
  ConstraintSource,
  AgentId,
  AgentRuntime,
  Concept,
  ADTEntry,
  FeedbackLoopState,
} from '@/types';

const EMPTY_BRIEF: ProductBrief = {
  name: '',
  function: '',
  constraints: {
    temp_max_C: 0,
    temp_min_C: 0,
    mass_max_kg: 0,
    mtbf_cycles: 0,
    cost_target_eur: 0,
    wall_min_mm: 0,
    ra_um: 0,
  },
  standards: [],
  behaviourExpected: { stress_max_MPa: 0, deflection_max_mm: 0, proof_ok: true },
  dfxPriorities: { dfm: 3, dfa: 3, dfr: 3, dfc: 3, dfs: 3 },
  agentLevels: {
    orchestrator: 3,
    retrieval: 4,
    generation: 2,
    simulation: 3,
    dfx: 3,
    doc: 4,
  },
};

function freshAgents(): Record<AgentId, AgentRuntime> {
  const mk = (): AgentRuntime => ({ status: 'idle', logs: [], elapsedMs: 0 });
  return {
    orchestrator: mk(),
    retrieval: mk(),
    generation: mk(),
    simulation: mk(),
    dfx: mk(),
    doc: mk(),
  };
}

let adtSeq = 0;
function nextAdtId() {
  adtSeq += 1;
  return `adt_${Date.now().toString(36)}_${adtSeq}`;
}

export interface AppState {
  scenario: ScenarioKey | null;
  scenarioName: string;
  brief: ProductBrief;
  constraintSources: Record<string, ConstraintSource>;
  agents: Record<AgentId, AgentRuntime>;
  concepts: Concept[];
  selectedConceptId: string | null;
  adt: ADTEntry[];
  feedbackLoop: FeedbackLoopState;
  apiKey: string | null; // memory only — never persisted
  demoMode: boolean;
  guidanceAnswers: Record<string, string>;
  runMode: 'autonomous' | 'supervised'; // E3 agent execution mode
  reviewAgent: AgentId | null; // agent currently paused awaiting human review

  // actions
  setScenario: (key: ScenarioKey, name: string) => void;
  setBrief: (brief: ProductBrief) => void;
  patchBrief: (patch: Partial<ProductBrief>) => void;
  setConstraintSource: (field: string, src: ConstraintSource) => void;
  setAgent: (id: AgentId, patch: Partial<AgentRuntime>) => void;
  appendAgentLog: (id: AgentId, line: string) => void;
  resetAgents: () => void;
  setConcepts: (concepts: Concept[]) => void;
  addConcept: (concept: Concept) => void;
  updateConcept: (id: string, patch: Partial<Concept>) => void;
  selectConcept: (id: string | null) => void;
  setFeedbackLoop: (patch: Partial<FeedbackLoopState>) => void;
  setApiKey: (key: string | null) => void;
  setGuidance: (key: string, value: string) => void;
  setRunMode: (mode: 'autonomous' | 'supervised') => void;
  setReviewAgent: (agent: AgentId | null) => void;
  appendADT: (entry: Omit<ADTEntry, 'id' | 'timestamp'> & { timestamp?: string }) => ADTEntry;
  resetRun: () => void;
  resetAll: () => void;
}

const initial = () => ({
  scenario: null as ScenarioKey | null,
  scenarioName: '',
  brief: structuredClone(EMPTY_BRIEF),
  constraintSources: {} as Record<string, ConstraintSource>,
  agents: freshAgents(),
  concepts: [] as Concept[],
  selectedConceptId: null as string | null,
  adt: [] as ADTEntry[],
  feedbackLoop: { phase: 'idle', step: 0, deviationPct: null } as FeedbackLoopState,
  apiKey: null as string | null,
  demoMode: true,
  guidanceAnswers: {} as Record<string, string>,
  runMode: 'supervised' as 'autonomous' | 'supervised',
  reviewAgent: null as AgentId | null,
});

export const useAppState = create<AppState>()(
  persist(
    (set, get) => ({
      ...initial(),

      setScenario: (scenario, scenarioName) => set({ scenario, scenarioName }),
      setBrief: (brief) => set({ brief }),
      patchBrief: (patch) => set({ brief: { ...get().brief, ...patch } }),
      setConstraintSource: (field, src) =>
        set({ constraintSources: { ...get().constraintSources, [field]: src } }),
      setAgent: (id, patch) =>
        set({ agents: { ...get().agents, [id]: { ...get().agents[id], ...patch } } }),
      appendAgentLog: (id, line) => {
        const a = get().agents[id];
        set({ agents: { ...get().agents, [id]: { ...a, logs: [...a.logs, line].slice(-12) } } });
      },
      resetAgents: () => set({ agents: freshAgents() }),
      setConcepts: (concepts) => set({ concepts }),
      addConcept: (concept) => set({ concepts: [...get().concepts, concept] }),
      updateConcept: (id, patch) =>
        set({ concepts: get().concepts.map((c) => (c.id === id ? { ...c, ...patch } : c)) }),
      selectConcept: (selectedConceptId) => set({ selectedConceptId }),
      setFeedbackLoop: (patch) => set({ feedbackLoop: { ...get().feedbackLoop, ...patch } }),
      setApiKey: (apiKey) => set({ apiKey, demoMode: !apiKey }),
      setGuidance: (key, value) =>
        set({ guidanceAnswers: { ...get().guidanceAnswers, [key]: value } }),
      setRunMode: (runMode) => set({ runMode }),
      setReviewAgent: (reviewAgent) => set({ reviewAgent }),
      appendADT: (entry) => {
        const full: ADTEntry = {
          id: nextAdtId(),
          timestamp: entry.timestamp ?? new Date().toISOString(),
          ...entry,
        };
        set({ adt: [...get().adt, full] });
        return full;
      },
      resetRun: () =>
        set({
          agents: freshAgents(),
          concepts: [],
          selectedConceptId: null,
          adt: [],
          feedbackLoop: { phase: 'idle', step: 0, deviationPct: null },
          constraintSources: {},
          guidanceAnswers: {},
          reviewAgent: null,
          runMode: 'supervised', // each new project starts in step-by-step review
        }),
      resetAll: () => set({ ...initial() }),
    }),
    {
      name: 'apda-app-state',
      storage: createJSONStorage(() => sessionStorage),
      // never persist the API key
      partialize: (s) => {
        // never persist the API key; reviewAgent is transient (avoid a stale gate on reload)
        const { apiKey: _apiKey, reviewAgent: _reviewAgent, ...rest } = s;
        return rest as AppState;
      },
    },
  ),
);
