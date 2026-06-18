# 04 — HITL Autonomy Matrix (L1–L5 per agent)

Each agent has an independent HITL level (L1–L5), configurable separately in E1/E2.
The level determines what the agent does, what the human does, and what the UI shows
and requests.

**Coherence rule**: incoherent combinations (e.g. Orchestrator L5 while another
agent is at L1) trigger an explicit warning before launch is allowed.

## Level definitions

| Level | Name | Principle | Typical risk context |
|---|---|---|---|
| L1 | Opérateur | AI is a tool only. Human makes all decisions. | Regulated sectors, irreversible critical decisions |
| L2 | Collaborateur | Human and AI co-design. AI suggests, human validates everything. | High creative/strategic value tasks |
| L3 | Consultant | AI produces the analysis, human picks among ranked options. | Complex technical decisions needing human expertise |
| L4 | Approbateur | AI pre-selects, human approves or cancels. | Well-defined low-ambiguity technical tasks |
| L5 | Observateur | AI acts autonomously, human monitors KPIs. | Only low-risk agents (Doc, Retrieval) |

## Orchestrator

| Level | Agent does | Human does | UI / available action |
|---|---|---|---|
| L1 | Analyzes brief. Proposes sequenced execution plan with estimated durations. | Reads plan. Can reorder steps, remove an agent, modify parameters before validation. | Editable Gantt view, draggable steps. → Valider / Modifier le plan |
| L2 | Generates 2–3 plan variants (order, parallelism, active agents). | Picks a variant; can adjust it before launch. | Side-by-side variant comparison. → Sélectionner une variante |
| L3 | Produces a recommended plan with justification. Launches agents. | Watches the running plan; can suspend or reconfigure an active agent. | Live timeline, per-agent pause button, threshold alerts. → Suspendre / Reconfigurer |
| L4 | Executes autonomously. Reroutes if an agent fails. | Monitors KPIs; notified when a critical decision emerges. | KPI dashboard, push notification for critical decisions. → Approuver la décision critique |
| L5 | Full workflow management. Auto-retry. Logs every decision. | Reads final summary; can audit the log. | Exportable log, global health indicator. → Consulter le log |

## Retrieval Agent

| Level | Agent does | Human does | UI / available action |
|---|---|---|---|
| L1 | Waits for a structured query; executes search on designated sources. | Formulates query (terms, sources, filters); launches manually. | Query form, source selector. → Lancer la recherche |
| L2 | Proposes 3–5 candidate queries with sources + rationale; waits for validation. | Selects or edits a query; validates before execution. | Proposed query list, inline editor. → Valider la requête |
| L3 | Executes searches; returns raw results ranked by relevance. | Filters results, excludes irrelevant sources, validates context. | Scored result list, exclusion checkboxes. → Confirmer le contexte |
| L4 | Searches, selects, synthesizes; produces ready-to-use structured context. | May exclude a source or request deepening; approves context. | Context summary with cited sources, "Approfondir" button. → Approuver / Exclure |
| L5 | Continuous search and context updates; alerts on contradictory data. | Sees a summary; alerted on contradiction. | Context banner, red alert on conflict. → Traiter le conflit |

## Generation Agent

| Level | Agent does | Human does | UI / available action |
|---|---|---|---|
| L1 | Waits for complete parameters (F, S, concept count, DFx constraints). | Defines all parameters; launches manually. | Full form, F/B/S parameters, concept counter (1–10). → Lancer |
| L2 | Proposes a generation configuration (count, variation axes); waits for validation. | Adjusts the proposed config; validates before generation. | Pre-filled editable form, variation-axes preview. → Valider la config |
| L3 | Generates N concepts with FBS + preliminary DFx; presents without recommendation. | Studies the concepts; may request additional variants. | Concept grid, "Générer variante" button, **no visible recommendation**. → Demander variante / Continuer |
| L4 | Generates and ranks by composite DFx score; recommends the best. | Reviews the recommendation; may override. | Highlighted recommended concept, radar comparison, override button. → Accepter / Overrider |
| L5 | Generates, ranks and auto-selects; notifies the human. | Sees the selected concept + justification; may reopen selection. | Chosen-concept summary, full-detail link. → Confirmer / Rouvrir |

## Simulation Agent

| Level | Agent does | Human does | UI / available action |
|---|---|---|---|
| L1 | Waits for simulation parameters (solver, mesh, boundary conditions). | Manually configures all parameters; launches computation. | Full technical form, solver selector, FEM parameters. → Lancer |
| L2 | Proposes a simulation configuration with justification; awaits approval. | Reviews proposed config, modifies if needed, approves launch. | Proposed config with rationale, editable fields. → Approuver la config |
| L3 | Runs simulation, produces Bs, compares Bs vs Be, presents the gap. | Interprets results; decides if gap is acceptable or triggers redesign. | Bs/Be radar, gap indicator. → Acceptable / Redesign |
| L4 | Runs, compares Bs/Be, recommends redesign if gap > threshold. | Approves or rejects redesign recommendation; can modify the threshold. | Result + recommendation, adjustable threshold. → Approuver / Rejeter redesign |
| L5 | Full loop: simulation → comparison → redesign → resimulation as needed. | Monitors convergence; receives final validated result. | Convergence indicator, iteration log. → Consulter le résultat |

## Documentation Agent

| Level | Agent does | Human does | UI / available action |
|---|---|---|---|
| L1 | Waits for human-provided data to document. | Enters everything manually; validates each thread entry. | Entry form, mandatory source field, entry history. → Ajouter une entrée |
| L2 | Auto-captures agent outputs; proposes thread entries. | Validates or corrects each entry before ADT archiving. | Entry validation queue, inline editor. → Valider les entrées |
| L3 | Builds the digital thread continuously; proposes phase summaries. | Reviews phase summaries; may add manual annotations. | Real-time thread, annotation section, gap alerts. → Annoter / Compléter |
| L4 | Manages the ADT autonomously; produces the gate review report. | Approves the report before export/archiving; may sign. | Preview-able report, approve+sign button, PDF/TXT export. → Approuver et signer |
| L5 | Fully automated ADT: versioning, archiving, EU AI Act compliance. | Consults the ADT on demand; audits if necessary. | Read-only view, thread search, audit export. → Auditer |

## DFx Agents (×5, configured as one row)

Same level semantics applied to scoring review:
L1 human enters evidence and confirms each score input; L2 validates each agent's
inputs; L3 reviews justifications among ranked criteria; L4 approves the score pack;
L5 monitors only. (Scores themselves are always deterministic regardless of level —
the level controls review of inputs and justifications, never the math.)
