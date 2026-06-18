// Backend integration state for the workflow. Keeps the resolved custom fields and
// whether they came from the live API or the offline fallback, so the UI can show a
// "Connecté / Hors-ligne" badge. Not persisted — re-derived each session.
import { create } from 'zustand';
import type { CustomField } from '@/api/client';
import { connectorFixtures } from '@/config/connectorFixtures';

export type FieldsSource = 'backend' | 'offline' | null;

interface BackendState {
  online: boolean | null; // null = unknown / not yet probed
  projectId: string | null;
  customFields: CustomField[];
  fieldsSource: FieldsSource;
  loading: boolean;
  setOnline: (online: boolean) => void;
  setProjectId: (id: string | null) => void;
  setFields: (fields: CustomField[], source: FieldsSource) => void;
  setLoading: (loading: boolean) => void;
  reset: () => void;
}

export const useBackendStore = create<BackendState>((set) => ({
  online: null,
  projectId: null,
  customFields: [],
  fieldsSource: null,
  loading: false,
  setOnline: (online) => set({ online }),
  setProjectId: (projectId) => set({ projectId }),
  setFields: (customFields, fieldsSource) => set({ customFields, fieldsSource }),
  setLoading: (loading) => set({ loading }),
  reset: () => set({ projectId: null, customFields: [], fieldsSource: null, loading: false }),
}));

const DFX_LABEL: Record<string, string> = {
  dfm: 'Fabricabilité (DFM)',
  dfa: 'Assemblage (DFA)',
  dfr: 'Fiabilité (DFR)',
  dfc: 'Coût (DFC)',
  dfs: 'Durabilité (DFS)',
};

function recommendedMaterial(tempMax: number): string {
  if (tempMax >= 150) return 'Acier inox / titane (haute température)';
  if (tempMax >= 100) return 'Acier ou fonte';
  return 'Alliage aluminium';
}

/**
 * Brief-derived custom fields for non-valve products — mirrors deriveBriefFields
 * in server/rag.ts so the offline demo matches the backend.
 */
function briefCustomFields(brief: any): CustomField[] {
  const c = brief?.constraints ?? {};
  const source = 'Brief produit structuré (agent Récupération)';
  const out: CustomField[] = [];
  const push = (key: string, label: string, value: unknown, unit?: string) =>
    out.push({ key, label, value, unit, source, confidence: 0.95 });

  if (Array.isArray(brief?.standards) && brief.standards.length > 0)
    push('applicable_standards', 'Normes applicables', brief.standards);
  push('recommended_material', 'Matériau recommandé', recommendedMaterial(Number(c.temp_max_C) || 0));
  if (c.cost_target_eur) push('target_cost_eur', 'Coût cible', c.cost_target_eur, '€');
  if (c.mass_max_kg) push('mass_budget_kg', 'Budget masse', c.mass_max_kg, 'kg');
  if (c.mtbf_cycles) push('mtbf_target_cycles', 'MTBF cible', c.mtbf_cycles, 'cycles');
  if (c.temp_max_C !== undefined) push('thermal_range_C', 'Plage thermique', `${c.temp_min_C ?? 0}…${c.temp_max_C}`, '°C');
  if (c.pressure_bar) push('service_pressure_bar', 'Pression de service', c.pressure_bar, 'bar');
  if (c.wall_min_mm) push('min_wall_mm', 'Paroi minimale', c.wall_min_mm, 'mm');
  const p = brief?.dfxPriorities as Record<string, number> | undefined;
  if (p) {
    const top = Object.keys(p).reduce((a, b) => (p[b] > p[a] ? b : a));
    push('top_priority', 'Priorité DFx dominante', DFX_LABEL[top] ?? top);
  }
  return out;
}

/**
 * Offline fallback: derive the custom fields the backend RAG would produce with no
 * server. For the curated DN100 valve (S2) this mirrors the knowledge-base RAG via
 * the simulated connector fixtures; every other product derives from its brief.
 */
export function offlineCustomFields(brief?: any, scenarioId?: string | null): CustomField[] {
  if (brief && scenarioId !== 'S2') return briefCustomFields(brief);

  const fields: CustomField[] = [];
  const std = connectorFixtures.std_norms;
  if (std) {
    const codes = (std.data as any[]).map((d) => d.code).filter(Boolean);
    fields.push({ key: 'applicable_standards', label: 'Normes applicables', value: codes, source: std.source, confidence: std.confidence ?? null });
  }
  const erp = connectorFixtures.erp_materials;
  if (erp) {
    const qualified = (erp.data as any[]).filter((m) => m.qualified && typeof m.cost_kg_eur === 'number');
    const best = qualified.reduce((a, b) => (b.cost_kg_eur < a.cost_kg_eur ? b : a), qualified[0]);
    if (best) {
      fields.push({ key: 'recommended_material', label: 'Matériau recommandé', value: best.material, source: erp.source, confidence: erp.confidence ?? null });
      fields.push({ key: 'material_lead_time_d', label: 'Délai appro matériau', value: best.lead_time_d, unit: 'j', source: erp.source, confidence: erp.confidence ?? null });
    }
  }
  const dt = connectorFixtures.dt_operational;
  if (dt) {
    const row = (dt.data as any[]).find((d) => typeof d.mean_stress_MPa === 'number');
    if (row) fields.push({ key: 'real_mean_stress_MPa', label: 'Contrainte moyenne réelle', value: row.mean_stress_MPa, unit: 'MPa', source: dt.source, confidence: dt.confidence ?? null });
  }
  const rex = connectorFixtures.rex_base;
  if (rex) {
    fields.push({ key: 'recommended_wall_min_mm', label: 'Épaisseur paroi mini (REX)', value: 8, unit: 'mm', source: rex.source, confidence: rex.confidence ?? null });
  }
  const sav = connectorFixtures.sav_returns;
  if (sav) {
    const f = (sav.data as any[])[0];
    if (f) {
      fields.push({ key: 'field_mtbf_cycles', label: 'MTBF terrain observé', value: f.mtbf_field, unit: 'cycles', source: sav.source, confidence: sav.confidence ?? null });
      fields.push({ key: 'dominant_failure_mode', label: 'Mode de défaillance dominant', value: `${f.failure_code} — ${f.desc}`, source: sav.source, confidence: sav.confidence ?? null });
    }
  }
  return fields;
}
