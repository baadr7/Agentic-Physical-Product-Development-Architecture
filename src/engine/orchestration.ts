// Scripted multi-agent execution (E3). Progresses agent statuses realistically,
// streams logs, pulses connectors, runs the real Orchestrator LLM call, and emits
// the DN100 concept set from the Generation agent. Every step writes the ADT.

import { useAppState } from '@/store/appState';
import { generateConcepts } from '@/engine/conceptGen';
import { AGENT_SOURCES, connectorFixtures } from '@/config/connectorFixtures';
import { runOrchestratorPlan } from '@/llm/calls';
import type { AgentId, Concept } from '@/types';
import type { ConnectorKey } from '@/components/ConnectorStrip';

const delay = (ms: number) => new Promise((r) => setTimeout(r, ms));

const AGENT_CONNECTORS: Record<AgentId, ConnectorKey[]> = {
  orchestrator: ['HITL', 'FBS'],
  retrieval: ['PLM', 'STD', 'ERP', 'DT'],
  generation: ['CAD', 'FBS', 'ERP'],
  simulation: ['CAD', 'DT', 'MES'],
  dfx: ['FBS'],
  doc: ['PLM', 'HITL'],
};

const LOGS: Record<AgentId, string[]> = {
  orchestrator: ['analyse du brief…', 'plan séquencé établi', 'dispatch aux agents'],
  retrieval: ['requête PLM/ERP/normes…', '6 sources interrogées', 'contexte structuré prêt'],
  generation: ['mapping F→S…', '4 concepts FBS générés', 'DFx préliminaire attaché'],
  simulation: ['maillage + solveur…', 'Bs calculé vs Be', 'statut PASS/REDESIGN'],
  dfx: ['DFM/DFA/DFR/DFC/DFS //', 'scores déterministes', 'justifications IA'],
  doc: ['agrégation ADT…', 'rapport gate review', 'BOM → ERP (simulé)'],
};

const SEQUENCE: AgentId[] = ['orchestrator', 'retrieval', 'generation', 'simulation', 'dfx', 'doc'];

let running = false;

// ---- HITL review gate ----
// In supervised mode the loop pauses after each agent and awaits a human decision:
// approve the work, or send an adjustment the agent incorporates before continuing.
export type GateDecision = { type: 'approve' } | { type: 'adjust'; note: string };

let gateResolver: ((d: GateDecision) => void) | null = null;

/** Resolve the open review gate (called from the E3 review panel). */
export function submitGateDecision(decision: GateDecision): void {
  const resolve = gateResolver;
  gateResolver = null;
  resolve?.(decision);
}

export function isAwaitingReview(): boolean {
  return gateResolver !== null;
}

/** Clear a stuck run/gate (used by Replay/reset). */
export function abortOrchestration(): void {
  running = false;
  gateResolver = null;
  useAppState.getState().setReviewAgent(null);
}

function waitForGate(): Promise<GateDecision> {
  return new Promise((resolve) => {
    gateResolver = resolve;
  });
}

export async function runOrchestration(
  onConnectors: (keys: ConnectorKey[]) => void,
  opts: { autonomous?: boolean } = {},
): Promise<void> {
  if (running) return;
  running = true;
  const st = useAppState.getState;

  try {
    for (const agent of SEQUENCE) {
      const s = st();
      const level = s.brief.agentLevels[agent];
      s.setAgent(agent, { status: 'running', logs: [], elapsedMs: 0 });
      onConnectors(AGENT_CONNECTORS[agent]);

      const timer = setInterval(() => {
        const cur = st().agents[agent];
        st().setAgent(agent, { elapsedMs: cur.elapsedMs + 200 });
      }, 200);

      // stream the 3 log lines
      for (const line of LOGS[agent]) {
        await delay(420);
        st().appendAgentLog(agent, line);
      }

      // agent-specific side effects
      if (agent === 'orchestrator') {
        const { data, meta } = await runOrchestratorPlan(s.apiKey, s.scenarioName, s.brief);
        st().setAgent('orchestrator', { output: data });
        st().appendADT({
          agent: 'orchestrator',
          event: 'plan_validated',
          source: meta.mode === 'live' ? 'DeepSeek' : 'DeepSeek (mock)',
          hitlLevel: level,
          payload: data,
        });
      }

      if (agent === 'retrieval') {
        const sources = AGENT_SOURCES.retrieval.map((x) => ({
          connector: x.connector,
          ...connectorFixtures[x.key],
        }));
        st().setAgent('retrieval', { output: sources });
        st().appendADT({
          agent: 'retrieval',
          event: 'context_retrieved',
          source: 'connecteur générique (simulé)',
          hitlLevel: level,
          payload: { sources: sources.map((x) => x.source) },
        });
      }

      if (agent === 'generation') {
        const concepts: Concept[] = generateConcepts(s.brief, s.scenario);
        st().setConcepts(concepts);
        st().appendADT({
          agent: 'generation',
          event: 'concepts_generated',
          source: 'Generation Agent',
          hitlLevel: level,
          payload: { count: concepts.length, ids: concepts.map((c) => c.id), product: s.brief.name },
        });
      }

      if (agent === 'simulation') {
        const concepts = st().concepts;
        st().appendADT({
          agent: 'simulation',
          event: 'simulation_done',
          source: 'Simulation Agent',
          hitlLevel: level,
          payload: concepts.map((c) => ({
            id: c.id,
            bs_MPa: c.fbs.behaviour.simulated.stress_max_MPa,
            be_MPa: c.fbs.behaviour.expected.stress_max_MPa,
          })),
        });
      }

      if (agent === 'dfx') {
        const concepts = st().concepts;
        st().appendADT({
          agent: 'dfx',
          event: 'dfx_scored',
          source: 'DFx ×5 (parallèle)',
          hitlLevel: level,
          payload: concepts.map((c) => ({ id: c.id, scores: c.scores })),
        });
      }

      if (agent === 'doc') {
        st().appendADT({
          agent: 'doc',
          event: 'thread_updated',
          source: 'Documentation Agent',
          hitlLevel: level,
          payload: { adt_entries: st().adt.length + 1 },
        });
      }

      clearInterval(timer);
      st().setAgent(agent, { status: 'done' });

      // HITL review gate — pause after each agent unless running autonomously.
      const supervised = !opts.autonomous && st().runMode === 'supervised';
      if (supervised) {
        onConnectors([]); // stop pulsing connectors while we wait for the human
        st().setReviewAgent(agent);
        const decision = await waitForGate();
        st().setReviewAgent(null);
        if (decision.type === 'approve') {
          st().appendADT({
            agent: 'human',
            event: 'agent_step_approved',
            source: 'revue HITL',
            hitlLevel: level,
            payload: { agent },
          });
        } else {
          st().appendADT({
            agent: 'human',
            event: 'agent_adjustment_requested',
            source: 'revue HITL',
            hitlLevel: level,
            payload: { agent, note: decision.note },
          });
          st().appendAgentLog(agent, `ajustement humain : ${decision.note}`);
          // the agent re-processes with the human's note, then proceeds
          st().setAgent(agent, { status: 'running' });
          await delay(700);
          st().setAgent(agent, { status: 'done' });
        }
      }

      await delay(250);
    }
    onConnectors([]);
  } finally {
    running = false;
  }
}

export function isOrchestrationComplete(): boolean {
  const a = useAppState.getState().agents;
  return SEQUENCE.every((id) => a[id].status === 'done');
}
