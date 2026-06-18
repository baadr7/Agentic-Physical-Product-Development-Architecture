# 00 — Overview & Scope

## Purpose

Interactive demo of the APDA research framework. It must simultaneously demonstrate
six scientific claims:

1. A multi-agent system can orchestrate an industrial design problem end-to-end.
2. The FBS ontology ensures semantic continuity across design phases.
3. Per-agent autonomy levels (HITL L1–L5) substantially change the designer's role.
4. DFx evaluation (including sustainability) can be parallelized and evidence-based.
5. The digital thread can be maintained agentically (ADT).
6. A closed feedback loop from manufacturing data back to design is technically feasible.

Audience: R&D team, industrial partners, academic evaluators.

## The 5 APDA layers and their status in the demo

| Layer | Name | Role | In the demo |
|---|---|---|---|
| L0 | PDP Overlay | Maps the company's product workflow phases | Phase banner in header — visually simulated |
| L1 | Human–AI Collaboration Map | Defines human/AI roles per step (HITL L1–L5) | **Implemented** — drives UI behavior on every screen |
| L2 | Agentic AI Orchestration | 6 agents coordinated by the Orchestrator | **Implemented** — real DeepSeek calls + simulated data |
| L3 | Industrial Integration | Connection to PLM, ERP, CAD, MES, Digital Twin… | Simulated via generic connector — JSON payloads visible |
| L4 | Data & Knowledge Foundation | Schemas, FBS ontology, data quality, governance | FBS as data structure — ontology simulated |

Left transversal — **Governance & Compliance** (EU AI Act, safety, audit trails):
the exported digital thread IS the compliant audit trail. Every HITL decision is
timestamped and sourced in the ADT.

Right transversal — **Organizational enablers** (training, change management,
governance board): out of app scope, documented in the exportable digital thread.

## The 6 agents

- **Orchestrator** — plans task sequences, routes sub-tasks, enforces HITL levels, triggers redesign loop.
- **Retrieval Agent** — queries all relevant sources via the generic connector (PLM, standards, ERP, Digital Twin, REX base, after-sales).
- **Generation Agent** — F→S mapping: generates candidate concepts with FBS + preliminary DFx.
- **Simulation Agent** — S→Bs mapping: computes simulated behavior, compares to Be, triggers redesign if Bs > Be.
- **DFx Agents (×5 parallel)** — DFM (manufacturability), DFA (assembly), DFR (reliability), DFC (cost), DFS (sustainability).
- **Documentation Agent** — maintains the ADT, gate review report, BOM export, AMDEC tool notifications.

(For HITL config the 5 DFx agents are treated as one row "DFx ×5".)

## Out of scope

| Excluded | Reason |
|---|---|
| Real PLM/CAD/FEA connections | All Layer 3 integrations are visually simulated via the generic connector |
| AMDEC computation/storage/display | The framework reads archived AMDECs from PLM/dedicated tools and notifies them when new Bs data exists. RPN computation stays in their system. |
| Backend, auth, database | Self-contained SPA, demoable offline |
| Text-to-CAD | Future phase, mentioned in roadmap only |
