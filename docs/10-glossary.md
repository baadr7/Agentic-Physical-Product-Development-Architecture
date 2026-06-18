# 10 — Glossary (E8 — 22 terms)

Each entry renders as: term name, APDA layer badge, 2–3 sentence definition,
DN100 example in italic. Stored in `src/config/glossary.ts`.

| # | Term | Layer badge | Definition + DN100 example |
|---|---|---|---|
| 1 | APDA | Framework | Agentic Physical Product Development Architecture — framework 5 couches superposant des agents IA au PDP existant de l'entreprise. |
| 2 | ADT | L2/L4 | Agentic Digital Thread — système multi-agents maintenant la continuité sémantique des données produit du brief jusqu'au feedback terrain. |
| 3 | Digital Thread | L4 | Flux de données structuré continu reliant chaque phase du cycle de vie : brief → concepts → simulation FBS → scoring DFx → approbation gate → boucle feedback → redesign. |
| 4 | FBS | L4 | Ontologie Function–Behaviour–Structure — décompose tout problème de conception en F (ce qu'il doit faire), B (comment il se comporte : Be attendu vs Bs simulé), S (comment il est fabriqué). |
| 5 | Function (F) | L4 | Les exigences fonctionnelles. *Pour DN100 : résister à 16 bar, assurer l'étanchéité, masse ≤ 2,8 kg, MTBF ≥ 50 000 cycles.* |
| 6 | Behaviour (B) | L4 | Comment le produit se comporte. *Be (attendu) = contrainte ≤ 120 MPa. Bs (simulé) = contrainte calculée depuis la géométrie par le Simulation Agent.* |
| 7 | Structure (S) | L4 | La réalisation physique : matériau, procédé, géométrie. *Concept A : AlSi10Mg coulée, paroi 7 mm, brides 4×M12.* |
| 8 | HITL (par agent) | L1 | Human-In-The-Loop — chaque agent a son propre niveau d'autonomie (L1–L5), configurable indépendamment. |
| 9 | L1 — Opérateur | L1 | L'IA est un outil uniquement. L'humain prend toutes les décisions. *Appliqué au Generation Agent en S1 (Aérospatial).* |
| 10 | L2 — Collaborateur | L1 | L'humain et l'IA co-conçoivent. L'IA suggère, l'humain valide tout. *Défaut pour le Generation Agent.* |
| 11 | L3 — Consultant | L1 | L'IA produit la majorité de l'analyse, l'humain choisit parmi les options classées. *Défaut pour S2.* |
| 12 | L4 — Approbateur | L1 | L'IA pré-sélectionne, l'humain approuve ou annule. *Défaut pour les agents Doc et Retrieval.* |
| 13 | L5 — Observateur | L1 | L'IA agit de façon autonome, l'humain surveille les KPIs. Autorisé uniquement pour les agents à faible risque. |
| 14 | Retrieval Agent | L2 | Interroge toutes les sources d'information pertinentes via le connecteur générique : PLM, normes, ERP, Digital Twin, base REX, SAV. |
| 15 | Generation Agent | L2 | Fait la correspondance F→S : génère des concepts candidats avec pack de disponibilité DFx pour chacun. |
| 16 | Simulation Agent | L2 | Fait la correspondance S→Bs : calcule le comportement simulé, compare à Be, déclenche la boucle redesign si Bs échoue Be. |
| 17 | DFx Agents (×5) | L2 | DFM (fabricabilité), DFA (assemblage), DFR (fiabilité), DFC (coût), DFS (durabilité). Exécutés en parallèle. |
| 18 | DFS — Design for Sustainability | L2 | Évalue recyclabilité %, empreinte CO₂, index matériau circulaire, scénario fin de vie. *Concept B (GGG40) score le plus élevé à 79/100.* |
| 19 | Connecteur générique | L3 | Interface standardisée abstrayant tout système externe (PLM, ERP, CAD, AMDEC…). Dans la démo : simulé avec payload JSON visible. En production : brancher le connecteur réel. |
| 20 | Boucle de feedback | L2/L3 | Données MES/IoT → réévaluation Simulation Agent → déclenchement redesign → nouvelle itération concept. *Visualisée en E5.* |
| 21 | Orchestrator | L2 | Planifie les séquences de tâches, route les sous-tâches aux agents, applique les niveaux HITL par agent, déclenche la boucle redesign sur échec de convergence. |
| 22 | Score DFx composite | L2 | Somme pondérée des scores DFM, DFA, DFR, DFC, DFS en utilisant les priorités du brief produit. Pilote le classement des concepts en E4. |
