# BUILD_PLAN — Phased prompts for Claude Code

Run phases in order. After each phase: `npm run dev`, verify the checklist,
`npm run test && npm run lint`, commit. Paste each prompt block verbatim.

---

## Phase 0 — Scaffold

```
Read CLAUDE.md and docs/01-architecture.md. Scaffold the project: Vite + React 18 +
TypeScript + Tailwind + Zustand + React Router + Chart.js + react-chartjs-2 + zod +
vitest. Set up the file structure from CLAUDE.md, the Tailwind design tokens from
docs/08-design-system.md, the app shell (persistent header with PDP phase banner,
scenario chip, API status badge, fixed "? Glossaire" button), and empty routed
screens E1–E8 with their French titles. No screen content yet.
```

✅ App runs, dark industrial shell, all routes navigable, tokens in tailwind.config.

## Phase 1 — Data layer + scoring engine (most important phase)

```
Read docs/02-data-model.md and docs/05-dfx-scoring.md fully. Implement:
1. src/config/scenarios.ts — the 6 scenarios with full ProductBriefs (S1 given in
   docs/02; derive S2–S5 coherently from the scenario table; S2 is the DN100 valve
   with standards EN 593 / EN 12334, Be = 120 MPa / 0.05 mm / proof 24 bar).
2. The 4 DN100 concepts (A–D) with their FIXED DFx scores and FBS data from docs/05.
3. src/engine/ — pure functions: the 5 DFx formulas (for custom briefs), composite
   score, rankConcepts, with the DFC inversion exactly as specified.
4. Vitest suite asserting the 5 verified rankings (S1→C, S2→A, S3→B, S4→B, S5→D),
   the DFC inversion edge cases (€85/€85→0, €42.5→50, €0→100), and clamping.
5. src/store/appState.ts — Zustand store per docs/01, with ADT append helper,
   sessionStorage persistence excluding apiKey.
All tests must pass before you finish.
```

✅ `npm run test` green, including the 5 ranking assertions.

## Phase 2 — E1 + E2

```
Read docs/03-screens.md (E1, E2 sections), docs/04-hitl-matrix.md, docs/02 (industry
presets). Implement E1 (scenario cards grid with S2 preselected, empty-project path,
DFx sliders with industry/manual modes + live radar, HITLSelector rows with allowed
ranges and the two agent/human text zones, coherence warning, pre-launch summary)
and E2 (3-column layout, constraint sources with simulated PLM/ERP import + conflict
dialog writing both sources to the ADT, optional NL extraction wired to the LLM layer
stub, live composite preview, agent config column). Build the shared components
HITLSelector, RadarDFx, HumanRoleBanner from docs/08.
```

✅ Full configuration flow E1→E2 works; every choice lands in appState + ADT.

## Phase 3 — LLM layer + demo mode

```
Read docs/09-ai-engine.md. Implement src/llm/: deepseek client, zod contracts for
the 4+1 call sites, retry-once-then-mock policy, settings modal for the API key
(memory only), Mode démo badge, and src/config/mockResponses.ts with realistic
French mocked responses for every call site (1–2 s simulated latency).
```

✅ With no key, all call sites return believable mocks; with a key, real calls validate against zod.

## Phase 4 — E3 dashboard + agent sub-screens

```
Read docs/03-screens.md (E3), docs/04-hitl-matrix.md, docs/06-connectors.md.
Implement the E3 dashboard: AgentCard grid 3×2 with status/logs/chronometer, the
ConnectorStrip (8 icons, pulse on trigger, Simulé badges), the Gantt timeline with
DFx ×5 parallel bars, the orchestrator LLM call, and a scripted agent execution
sequence (statuses progress realistically). Implement the 5 agent sub-screens with
their sources, PayloadViewer JSON payloads from simulatedConnector fixtures, outputs,
and HITL-level-dependent actions exactly per the matrix.
```

✅ Launching from E2 plays the full agent run; each sub-screen shows level-correct actions; ADT fills up.

## Phase 5 — E4 + E5 + feedback loop

```
Read docs/03-screens.md (E4, E5) and docs/07-feedback-loop.md. Implement E4 (concept
grid with parametric ConceptSVG, animated gauges, rank badges, recommended ribbon,
comparative radar, DFx justification LLM call) and E5 (FBS 3-column, DFx Readiness
Pack with PASS/FAIL at 70, Bs vs Be radar, simulation analysis LLM call) plus the
scripted 6-step DN100 feedback loop in the retractable panel: deviation badge, amber
pulse, redesign trigger, A-v2 generation with re-scoring (DFM 82→79) and fade-in on
E4, all steps appended to the ADT.
```

✅ Feedback loop plays end-to-end; A-v2 appears and re-ranks; ADT records every step.

## Phase 6 — E6 + E7 + E8

```
Read docs/03-screens.md (E6, E7, E8) and docs/10-glossary.md. Implement E6 with the
5 level-driven banner/button configurations (including L5 auto-confirm after 3 s and
the DFS ≥ 4 eco-ranking question), E7 gate review (decision card, residual-risks LLM
call with sustainability enforcement, ADTTimeline audit with ≥10 entries, compliance
badges, feedback summary, TXT export named gate_review_[produit]_[date].txt), and E8
glossary (22 terms, layer badges, live filter).
```

✅ Full happy path E1→E7 with export; E6 behaves differently at every orchestrator level.

## Phase 7 — Polish pass

```
Read docs/08-design-system.md again. Audit every screen against the commercial
industrial bar: density, hierarchy, consistent color mapping (FBS, agents, DFS
emerald, human blue), motion specs, prefers-reduced-motion, 1280px minimum. Fix
empty states, loading states, and error states. Run lint + tests. Then do one full
demo walkthrough of scenario S2 and one of S1 (note how Generation L1 changes the
flow) and fix anything that breaks the narrative.
```

✅ Demoable end-to-end offline, looks deployable, all tests green.
