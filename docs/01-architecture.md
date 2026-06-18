# 01 — Architecture

## Why a self-contained SPA

The previous codebase was a turborepo monorepo (Next.js + FastAPI + Supabase +
diffusion/CLIP services). That contradicts the CDC: the demo requires **no real
integrations**, **no persistence beyond a session**, and must run anywhere for
academic/industrial demos. A Vite SPA with all data in config files satisfies
every requirement with ~1/20th of the surface area.

## State management

Single Zustand store `appState`:

```ts
interface AppState {
  scenario: ScenarioId | 'custom' | null;
  brief: ProductBrief;              // includes dfxPriorities + agentLevels
  constraintSources: Record<string, ConstraintSource>; // 'manual' | 'plm_import' | 'erp_import' | 'nl_extracted'
  agents: Record<AgentId, AgentRuntime>;   // status, logs, timer, outputs
  concepts: Concept[];              // generated concepts incl. A-v2 after feedback loop
  selectedConceptId: string | null;
  adt: ADTEntry[];                  // the digital thread — append-only
  feedbackLoop: FeedbackLoopState;  // idle | deviation_detected | redesign_running | completed
  apiKey: string | null;            // memory only, never persisted
  demoMode: boolean;                // true when no key → mocked LLM responses
}
```

- Persist to `sessionStorage` EXCEPT `apiKey`.
- Every mutation that represents a decision/agent output also appends an `ADTEntry`
  `{ id, timestamp, agent, event, source, payload, hitlLevel }`.

## Routing

```
/      → redirect /e1
/e1    Scenario choice & parameterization
/e2    Technical constraints configuration
/e3    Multi-agent dashboard          /e3/:agentId  agent sub-screen
/e4    Generated concepts
/e5/:conceptId  Concept detail + feedback panel
/e6    HITL selection
/e7    Gate review
/e8    Glossary (also reachable from the fixed "? Glossaire" button on all screens)
```

Guard navigation: E3+ requires a brief; E4+ requires agents done; E7 requires a selection.

## Engine layer (pure, tested)

`src/engine/` contains zero React. Pure functions:

- `scoreDFM/DFA/DFR/DFC/DFS(brief, concept): number`
- `compositeScore(scores, priorities): number`
- `rankConcepts(concepts, priorities): RankedConcept[]`
- `checkFeedbackDeviation(bsReal, bsPredicted, thresholdPct): Deviation | null`
- `runRedesign(concept): Concept` (A → A-v2: wall 7→8mm, DFM 82→79, recompute)

Vitest covers all formulas + the 5 verified scenario rankings (docs/05). CI-gate.

## LLM layer

`src/llm/deepseek.ts` — fetch to `https://api.deepseek.com/v1/chat/completions`
(OpenAI-compatible, CORS-native). Model swappable via one constant.
All responses validated with zod schemas in `contracts.ts`; on parse failure,
retry once with a "respond ONLY with JSON" reminder, then fall back to mocks.

Exactly 4 real call sites (see docs/09):
1. E3 Orchestrator plan
2. E4 DFx justifications (1 call, all concepts)
3. E5 Simulation analysis
4. E7 residual risks

Plus optional: E2 natural-language → structured constraints extraction.
