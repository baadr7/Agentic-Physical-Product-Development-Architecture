// High-level, screen-facing LLM call sites. Each wires prompt + zod schema + mock
// through callLLM (retry-once-then-mock). Screens never touch fetch directly.

import { callLLM, type CallMeta } from './deepseek';
import {
  orchestratorPlanPrompt,
  justificationsPrompt,
  simulationPrompt,
  residualRisksPrompt,
} from './prompts';
import {
  OrchestratorPlanSchema,
  DFxJustificationsSchema,
  SimulationAnalysisSchema,
  ResidualRisksSchema,
  type OrchestratorPlan,
  type DFxJustifications,
  type SimulationAnalysis,
  type ResidualRisks,
} from './contracts';
import {
  mockOrchestratorPlan,
  mockJustifications,
  mockSimulationAnalysis,
  mockResidualRisks,
} from '@/config/mockResponses';
import type { Concept, ProductBrief, Scenario } from '@/types';

export type LLMResult<T> = { data: T; meta: CallMeta };

export function runOrchestratorPlan(
  apiKey: string | null,
  scenarioName: string,
  brief: ProductBrief,
): Promise<LLMResult<OrchestratorPlan>> {
  return callLLM({
    apiKey,
    prompt: orchestratorPlanPrompt(scenarioName, brief),
    schema: OrchestratorPlanSchema,
    mock: mockOrchestratorPlan(scenarioName, brief),
  });
}

export function runJustifications(
  apiKey: string | null,
  concepts: Concept[],
  brief: ProductBrief,
): Promise<LLMResult<DFxJustifications>> {
  return callLLM({
    apiKey,
    prompt: justificationsPrompt(concepts, brief),
    schema: DFxJustificationsSchema,
    mock: mockJustifications(concepts),
  });
}

export async function runSimulationAnalysis(
  apiKey: string | null,
  concept: Concept,
): Promise<LLMResult<SimulationAnalysis>> {
  const be = concept.fbs.behaviour.expected;
  const bs = concept.fbs.behaviour.simulated;
  const status: 'PASS' | 'REDESIGN' =
    bs.stress_max_MPa <= be.stress_max_MPa && bs.deflection_max_mm <= be.deflection_max_mm
      ? 'PASS'
      : 'REDESIGN';
  const res = await callLLM({
    apiKey,
    prompt: simulationPrompt(concept, status),
    schema: SimulationAnalysisSchema,
    mock: mockSimulationAnalysis(concept),
  });
  // bs_be_status must echo the deterministic status; otherwise override (docs/09)
  if (res.data.bs_be_status !== status) res.data.bs_be_status = status;
  return res;
}

export async function runResidualRisks(
  apiKey: string | null,
  concept: Concept,
  scenario: Scenario | null,
  feedbackTriggered: boolean,
): Promise<LLMResult<ResidualRisks>> {
  const res = await callLLM({
    apiKey,
    prompt: residualRisksPrompt(concept, scenario, feedbackTriggered),
    schema: ResidualRisksSchema,
    mock: mockResidualRisks(concept, scenario, feedbackTriggered),
  });
  // enforce >=1 sustainability risk (docs/09)
  const hasSus = res.data.risks.some((r) => /durab/i.test(r.category));
  if (!hasSus) {
    res.data.risks[2] = mockResidualRisks(concept, scenario, feedbackTriggered).risks[2];
  }
  return res;
}
