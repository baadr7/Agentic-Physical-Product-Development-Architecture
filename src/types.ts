// Core domain types for the APDA demo. English identifiers; UI strings live in i18n.

export type Lang = 'fr' | 'en';

export type ScenarioId = 'S1' | 'S2' | 'S3' | 'S4' | 'S5' | 'S6';
export type ScenarioKey = ScenarioId | 'custom';

export type AgentId =
  | 'orchestrator'
  | 'retrieval'
  | 'generation'
  | 'simulation'
  | 'dfx'
  | 'doc';

export type HITLLevel = 1 | 2 | 3 | 4 | 5;

export type DFxKey = 'dfm' | 'dfa' | 'dfr' | 'dfc' | 'dfs';

export interface DFxScores {
  dfm: number;
  dfa: number;
  dfr: number;
  dfc: number;
  dfs: number;
}

export interface AgentLevels {
  orchestrator: HITLLevel;
  retrieval: HITLLevel;
  generation: HITLLevel;
  simulation: HITLLevel;
  dfx: HITLLevel;
  doc: HITLLevel;
}

export interface ProductBrief {
  name: string;
  function: string;
  constraints: {
    temp_max_C: number;
    temp_min_C: number;
    mass_max_kg: number;
    mtbf_cycles: number;
    cost_target_eur: number;
    wall_min_mm: number;
    ra_um: number;
    pressure_bar?: number;
  };
  standards: string[];
  behaviourExpected: {
    stress_max_MPa: number;
    deflection_max_mm: number;
    proof_ok: boolean;
  };
  // priorities + agent levels travel with the working brief
  dfxPriorities: DFxScores;
  agentLevels: AgentLevels;
}

export interface Scenario {
  id: ScenarioId;
  name: string;
  icon: 'aerospace' | 'industrial' | 'sustainable' | 'startup' | 'automotive' | 'custom';
  description: string;
  dfxPriorities: DFxScores;
  agentLevels: AgentLevels;
  globalHITL: HITLLevel;
  humanRole: string;
  productBrief: Omit<ProductBrief, 'dfxPriorities' | 'agentLevels'>;
}

// --- FBS structured concept ---

export interface FBSFunction {
  requirements: string[];
}

export interface FBSBehaviour {
  expected: { stress_max_MPa: number; deflection_max_mm: number; proof_ok: boolean };
  simulated: { stress_max_MPa: number; deflection_max_mm: number; proof_ok: boolean };
}

export interface FBSStructure {
  material: string;
  process: 'casting' | 'cnc' | 'hybrid';
  wall_mm: number;
  flanges: string;
  bore_mm: number;
  length_mm: number;
}

export interface Concept {
  id: string; // 'A' | 'B' | 'C' | 'D' | 'A-v2'
  name: string;
  materialProcess: string;
  scores: DFxScores; // deterministic / fixed for DN100 dataset
  cost_eur: number;
  mass_kg: number;
  weakness: string;
  fbs: {
    function: FBSFunction;
    behaviour: FBSBehaviour;
    structure: FBSStructure;
  };
  justifications?: Record<DFxKey, string>; // filled by LLM at E4
  derivedFrom?: string; // 'A' for A-v2
}

export interface RankedConcept extends Concept {
  composite: number;
  rank: number;
}

// --- Connector / Layer 3 ---

export interface ConnectorRequest {
  connector_id: string;
  query_type: string;
  filters: Record<string, unknown>;
  max_results: number;
}

export interface ConnectorResponse {
  source: string;
  timestamp: string;
  data: unknown[];
  confidence?: number;
}

export interface ConnectorEvent {
  connector_id: string;
  event_type: string;
  payload: Record<string, unknown>;
  adt_entry_id?: string;
}

// --- ADT ---

export interface ADTEntry {
  id: string;
  timestamp: string;
  agent: AgentId | 'human' | 'system';
  event: string;
  source: string;
  hitlLevel?: number;
  payload: unknown;
}

// --- Constraint sources ---

export type ConstraintSourceKind = 'manual' | 'plm_import' | 'erp_import' | 'nl_extracted';

export interface ConstraintSource {
  kind: ConstraintSourceKind;
  source: string; // display name e.g. 'Windchill 12.1 (simulé)'
  timestamp: string;
}

// --- Agent runtime ---

export type AgentStatus = 'idle' | 'running' | 'done' | 'error';

export interface AgentRuntime {
  status: AgentStatus;
  logs: string[];
  elapsedMs: number;
  output?: unknown;
}

// --- Feedback loop ---

export type FeedbackPhase =
  | 'idle'
  | 'sensor_read'
  | 'deviation_detected'
  | 'be_revised'
  | 'redesign_triggered'
  | 'redesign_running'
  | 'completed';

export interface FeedbackLoopState {
  phase: FeedbackPhase;
  step: number; // 0..6
  deviationPct: number | null;
}
