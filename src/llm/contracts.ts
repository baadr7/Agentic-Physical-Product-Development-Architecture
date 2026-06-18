import { z } from 'zod';

// Zod schemas validating every LLM JSON response (docs/09). On parse failure the
// client retries once with a corrective reminder, then falls back to a mock.

// 1 — E3 Orchestrator plan
export const PlanStepSchema = z.object({
  step: z.number(),
  agent: z.string(),
  action: z.string(),
  duration_s: z.number(),
});
export const OrchestratorPlanSchema = z.object({
  plan: z.array(PlanStepSchema).min(1),
  hitl_comment: z.string(),
  key_risk: z.string(),
  sustainability_note: z.string(),
});
export type OrchestratorPlan = z.infer<typeof OrchestratorPlanSchema>;

// 2 — E4 DFx justifications (one call, all concepts)
export const JustificationSchema = z.object({
  concept_id: z.string(),
  dfm: z.string(),
  dfa: z.string(),
  dfr: z.string(),
  dfc: z.string(),
  dfs: z.string(),
});
export const DFxJustificationsSchema = z.object({
  justifications: z.array(JustificationSchema).min(1),
});
export type DFxJustifications = z.infer<typeof DFxJustificationsSchema>;

// 3 — E5 Simulation analysis
export const SimulationAnalysisSchema = z.object({
  fbs_summary: z.string(),
  bs_be_status: z.enum(['PASS', 'REDESIGN']),
  engineering_note: z.string(),
  feedback_loop_risk: z.string(),
});
export type SimulationAnalysis = z.infer<typeof SimulationAnalysisSchema>;

// 4 — E7 Residual risks
export const RiskSchema = z.object({
  risk: z.string(),
  severity: z.enum(['faible', 'moyen', 'élevé']),
  category: z.string(),
  mitigation: z.string(),
});
export const ResidualRisksSchema = z.object({
  risks: z.array(RiskSchema).length(3),
});
export type ResidualRisks = z.infer<typeof ResidualRisksSchema>;

// 5 (optional) — E2 NL → structured constraints
export const NLConstraintsSchema = z.object({
  constraints: z.record(z.string(), z.number()).optional(),
  standards: z.array(z.string()).optional(),
});
export type NLConstraints = z.infer<typeof NLConstraintsSchema>;
