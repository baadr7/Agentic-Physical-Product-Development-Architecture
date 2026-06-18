// Loads scenario templates from files (server/data/scenarios/*.json) — the source
// of truth for the scenarios table and the RAG knowledge base. Add or edit a
// scenario by dropping/editing a JSON file here, then re-running db:seed.
import { readFileSync, readdirSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';
import type { SeedScenario } from './seed.data.ts';

const __dirname = dirname(fileURLToPath(import.meta.url));
export const SCENARIOS_DIR = resolve(__dirname, 'data', 'scenarios');

/** A scenario file: the seed shape plus a free-text `knowledge` block for RAG. */
export interface ScenarioFile extends SeedScenario {
  knowledge?: string;
}

export function loadScenarios(): ScenarioFile[] {
  const files = readdirSync(SCENARIOS_DIR).filter((f) => f.endsWith('.json')).sort();
  return files.map((f) => JSON.parse(readFileSync(resolve(SCENARIOS_DIR, f), 'utf8')) as ScenarioFile);
}

/** Natural-language text used to embed a scenario into the RAG knowledge base. */
export function scenarioKnowledgeText(s: ScenarioFile): string {
  if (s.knowledge && s.knowledge.trim()) return `${s.name} (${s.id}). ${s.knowledge}`;
  const pr = s.dfx_priorities;
  return `${s.name} (${s.id}). ${s.description}. HITL global L${s.global_hitl}, rôle ${s.human_role}. ` +
    `Priorités DFx — DFM ${pr.dfm}, DFA ${pr.dfa}, DFR ${pr.dfr}, DFC ${pr.dfc}, DFS ${pr.dfs}.`;
}
