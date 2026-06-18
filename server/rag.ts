// Minimal but real RAG: sparse term-frequency embeddings + cosine retrieval over
// the seeded knowledge base, plus derivation of workflow "custom fields" from the
// retrieved documents. Offline and deterministic (no API key needed for the demo).
// The embedding/retrieval functions are isolated so a dense provider (OpenAI /
// DeepSeek / sentence-transformers + pgvector) can replace them without touching
// the rest of the pipeline.
import type { DatabaseSync } from 'node:sqlite';
import { parseJson } from './db.ts';

// ---- tokenization & embedding ----

const STOPWORDS = new Set([
  'le', 'la', 'les', 'un', 'une', 'des', 'de', 'du', 'et', 'ou', 'a', 'au', 'aux',
  'en', 'sur', 'pour', 'par', 'avec', 'sans', 'sous', 'the', 'of', 'and', 'or',
  'to', 'in', 'on', 'for', 'with', 'is', 'are', 'be', 'as', 'at', 'by',
]);

export function tokenize(text: string): string[] {
  return text
    .toLowerCase()
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '') // strip diacritics
    .replace(/[^a-z0-9]+/g, ' ')
    .split(' ')
    .filter((t) => t.length >= 2 && !STOPWORDS.has(t));
}

export type SparseVec = Record<string, number>;

/** Term-frequency embedding (JSON-serializable). */
export function embed(text: string): SparseVec {
  const v: SparseVec = {};
  for (const tok of tokenize(text)) v[tok] = (v[tok] ?? 0) + 1;
  return v;
}

function norm(v: SparseVec): number {
  let s = 0;
  for (const k in v) s += v[k] * v[k];
  return Math.sqrt(s);
}

export function cosine(a: SparseVec, b: SparseVec): number {
  const na = norm(a);
  const nb = norm(b);
  if (na === 0 || nb === 0) return 0;
  // iterate the smaller vector
  const [small, big] = Object.keys(a).length <= Object.keys(b).length ? [a, b] : [b, a];
  let dot = 0;
  for (const k in small) if (k in big) dot += small[k] * big[k];
  return dot / (na * nb);
}

// ---- retrieval ----

export interface RetrievalHit {
  chunkId: string;
  documentId: string;
  connector: string;
  source: string;
  title: string;
  text: string;
  confidence: number | null;
  metadata: Record<string, unknown>;
  score: number;
}

export function retrieve(db: DatabaseSync, query: string, k = 5): RetrievalHit[] {
  const q = embed(query);
  const rows = db
    .prepare(
      `SELECT c.id AS chunkId, c.document_id AS documentId, c.text AS text, c.embedding AS embedding,
              d.connector AS connector, d.source AS source, d.title AS title,
              d.confidence AS confidence, d.metadata AS metadata
         FROM knowledge_chunks c
         JOIN knowledge_documents d ON d.id = c.document_id`,
    )
    .all() as any[];

  const scored: RetrievalHit[] = rows.map((r) => ({
    chunkId: r.chunkId,
    documentId: r.documentId,
    connector: r.connector,
    source: r.source,
    title: r.title,
    text: r.text,
    confidence: r.confidence ?? null,
    metadata: parseJson<Record<string, unknown>>(r.metadata, {}),
    score: cosine(q, parseJson<SparseVec>(r.embedding, {})),
  }));

  return scored
    .filter((h) => h.score > 0)
    .sort((a, b) => b.score - a.score)
    .slice(0, k);
}

// ---- custom-field derivation ----

export interface DerivedField {
  key: string;
  label: string;
  value: unknown;
  unit?: string;
  source: string;
  sourceDocumentId: string | null;
  confidence: number | null;
  rationale: string;
}

interface FieldSpec {
  key: string;
  label: string;
  unit?: string;
  query: string;
  connector?: string; // prefer a hit from this connector
  extract: (meta: Record<string, any>, hit: RetrievalHit) => { value: unknown; rationale: string } | null;
}

const FIELD_SPECS: FieldSpec[] = [
  {
    key: 'applicable_standards',
    label: 'Normes applicables',
    query: 'normes vannes papillon robinetterie clapets en vigueur',
    connector: 'STD',
    extract: (meta) => {
      const list = (meta.data ?? meta.standards ?? []) as any[];
      const codes = list.map((s) => s.code ?? s).filter(Boolean);
      if (codes.length === 0) return null;
      return { value: codes, rationale: `Normes en vigueur retrouvées dans ${list.length} entrées du référentiel.` };
    },
  },
  {
    key: 'recommended_material',
    label: 'Matériau recommandé',
    query: 'matériau qualifié fournisseur coût kg délai approvisionnement',
    connector: 'ERP',
    extract: (meta) => {
      const mats = (meta.data ?? []) as any[];
      const qualified = mats.filter((m) => m.qualified && typeof m.cost_kg_eur === 'number');
      if (qualified.length === 0) return null;
      const best = qualified.reduce((a, b) => (b.cost_kg_eur < a.cost_kg_eur ? b : a));
      return {
        value: best.material,
        rationale: `Coût matière le plus bas parmi les matériaux qualifiés (${best.cost_kg_eur} €/kg, fournisseur ${best.supplier}).`,
      };
    },
  },
  {
    key: 'material_lead_time_d',
    label: 'Délai appro matériau',
    unit: 'j',
    query: 'délai approvisionnement fournisseur matériau lead time',
    connector: 'ERP',
    extract: (meta) => {
      const mats = (meta.data ?? []) as any[];
      const qualified = mats.filter((m) => m.qualified && typeof m.cost_kg_eur === 'number');
      if (qualified.length === 0) return null;
      const best = qualified.reduce((a, b) => (b.cost_kg_eur < a.cost_kg_eur ? b : a));
      if (typeof best.lead_time_d !== 'number') return null;
      return { value: best.lead_time_d, rationale: `Délai du fournisseur ${best.supplier} pour ${best.material}.` };
    },
  },
  {
    key: 'real_mean_stress_MPa',
    label: 'Contrainte moyenne réelle',
    unit: 'MPa',
    query: 'contrainte moyenne mesurée capteurs digital twin parc en service',
    extract: (meta) => {
      const rows = (meta.data ?? []) as any[];
      const withStress = rows.find((r) => typeof r.mean_stress_MPa === 'number');
      if (!withStress) return null;
      return {
        value: withStress.mean_stress_MPa,
        rationale: 'Mesure terrain agrégée (parc en service) — à comparer à la prédiction de simulation.',
      };
    },
  },
  {
    key: 'recommended_wall_min_mm',
    label: 'Épaisseur paroi mini (REX)',
    unit: 'mm',
    query: 'retour expérience paroi épaisseur minimale contrainte réelle recommandation',
    connector: 'PLM',
    extract: (meta, hit) => {
      const m = /paroi\s*[≥>=]+\s*(\d+(?:[.,]\d+)?)\s*mm/i.exec(hit.text + ' ' + JSON.stringify(meta));
      if (!m) return null;
      return {
        value: Number(m[1].replace(',', '.')),
        rationale: 'Règle issue du retour d’expérience ingénierie (REX).',
      };
    },
  },
  {
    key: 'field_mtbf_cycles',
    label: 'MTBF terrain observé',
    unit: 'cycles',
    query: 'MTBF terrain défaillance siège fuite retours SAV',
    connector: 'SAV',
    extract: (meta) => {
      const rows = (meta.data ?? []) as any[];
      const withMtbf = rows.find((r) => typeof r.mtbf_field === 'number');
      if (!withMtbf) return null;
      return { value: withMtbf.mtbf_field, rationale: `Observé sur le code défaut ${withMtbf.failure_code ?? 'n/a'}.` };
    },
  },
  {
    key: 'dominant_failure_mode',
    label: 'Mode de défaillance dominant',
    query: 'mode défaillance code défaut fuite siège élastomère occurrences',
    connector: 'SAV',
    extract: (meta) => {
      const rows = (meta.data ?? []) as any[];
      const f = rows.find((r) => r.failure_code);
      if (!f) return null;
      return { value: `${f.failure_code} — ${f.desc}`, rationale: `${f.occurrences ?? '?'} occurrence(s) remontée(s) du terrain.` };
    },
  },
];

// ---- brief-derived fields (non-valve products) ----
// For any product other than the curated DN100 valve, the knowledge base has no
// matching records, so the Retrieval agent structures the project brief itself
// into clear, product-specific custom fields. Same shape as the RAG fields.

const DFX_LABEL: Record<string, string> = {
  dfm: 'Fabricabilité (DFM)',
  dfa: 'Assemblage (DFA)',
  dfr: 'Fiabilité (DFR)',
  dfc: 'Coût (DFC)',
  dfs: 'Durabilité (DFS)',
};

function topPriorityLabel(p: Record<string, number> | undefined): string | null {
  if (!p) return null;
  const top = Object.keys(p).reduce((a, b) => (p[b] > p[a] ? b : a));
  return DFX_LABEL[top] ?? top;
}

function recommendedMaterial(tempMax: number): string {
  if (tempMax >= 150) return 'Acier inox / titane (haute température)';
  if (tempMax >= 100) return 'Acier ou fonte';
  return 'Alliage aluminium';
}

export function deriveBriefFields(brief: any): DerivedField[] {
  const c = brief?.constraints ?? {};
  const source = 'Brief produit structuré (agent Récupération)';
  const out: DerivedField[] = [];
  const push = (
    key: string,
    label: string,
    value: unknown,
    extra: { unit?: string; rationale?: string } = {},
  ) =>
    out.push({
      key,
      label,
      unit: extra.unit,
      value,
      rationale: extra.rationale ?? 'Dérivé du brief produit structuré par l’agent Récupération.',
      source,
      sourceDocumentId: null,
      confidence: 0.95,
    });

  if (Array.isArray(brief?.standards) && brief.standards.length > 0)
    push('applicable_standards', 'Normes applicables', brief.standards, {
      rationale: 'Normes déclarées dans le brief produit.',
    });
  push('recommended_material', 'Matériau recommandé', recommendedMaterial(Number(c.temp_max_C) || 0), {
    rationale: 'Famille de matériaux adaptée à l’enveloppe thermique du brief.',
  });
  if (c.cost_target_eur) push('target_cost_eur', 'Coût cible', c.cost_target_eur, { unit: '€' });
  if (c.mass_max_kg) push('mass_budget_kg', 'Budget masse', c.mass_max_kg, { unit: 'kg' });
  if (c.mtbf_cycles) push('mtbf_target_cycles', 'MTBF cible', c.mtbf_cycles, { unit: 'cycles' });
  if (c.temp_max_C !== undefined)
    push('thermal_range_C', 'Plage thermique', `${c.temp_min_C ?? 0}…${c.temp_max_C}`, { unit: '°C' });
  if (c.pressure_bar) push('service_pressure_bar', 'Pression de service', c.pressure_bar, { unit: 'bar' });
  if (c.wall_min_mm) push('min_wall_mm', 'Paroi minimale', c.wall_min_mm, { unit: 'mm' });
  const top = topPriorityLabel(brief?.dfxPriorities);
  if (top) push('top_priority', 'Priorité DFx dominante', top);
  return out;
}

/**
 * Populate the project's custom fields. The curated DN100 valve (S2) uses the RAG
 * over the seeded knowledge base; every other product derives product-specific
 * fields from its structured brief.
 */
export function deriveCustomFields(
  db: DatabaseSync,
  opts: { scenarioId?: string | null; brief?: any } = {},
): DerivedField[] {
  if (opts.brief && opts.scenarioId !== 'S2') return deriveBriefFields(opts.brief);

  const out: DerivedField[] = [];
  for (const spec of FIELD_SPECS) {
    const hits = retrieve(db, spec.query, 5);
    const hit = spec.connector ? hits.find((h) => h.connector === spec.connector) ?? hits[0] : hits[0];
    if (!hit) continue;
    const extracted = spec.extract(hit.metadata, hit);
    if (!extracted) continue;
    out.push({
      key: spec.key,
      label: spec.label,
      unit: spec.unit,
      value: extracted.value,
      rationale: extracted.rationale,
      source: hit.source,
      sourceDocumentId: hit.documentId,
      confidence: hit.confidence,
    });
  }
  return out;
}
