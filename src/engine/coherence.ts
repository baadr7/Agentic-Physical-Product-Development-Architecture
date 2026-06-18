import type { AgentLevels } from '@/types';

export interface CoherenceWarning {
  level: 'warn' | 'info';
  message: { fr: string; en: string };
}

/**
 * Coherence rule (docs/04): incoherent autonomy combinations (e.g. Orchestrator L5
 * while another agent is at L1) trigger an explicit warning before launch.
 */
export function checkCoherence(levels: AgentLevels): CoherenceWarning[] {
  const out: CoherenceWarning[] = [];
  const vals = Object.values(levels);
  const min = Math.min(...vals);
  const max = Math.max(...vals);

  if (levels.orchestrator >= 5 && min <= 1) {
    out.push({
      level: 'warn',
      message: {
        fr: "Orchestrateur en L5 (autonome) alors qu'un agent est en L1 (manuel) : combinaison incohérente.",
        en: 'Orchestrator at L5 (autonomous) while an agent is at L1 (manual): incoherent combination.',
      },
    });
  }
  if (max - min >= 3) {
    out.push({
      level: 'warn',
      message: {
        fr: `Écart d'autonomie élevé (L${min}→L${max}) entre agents : vérifiez la cohérence du workflow.`,
        en: `Large autonomy spread (L${min}→L${max}) across agents: check workflow coherence.`,
      },
    });
  }
  if (levels.generation <= 1) {
    out.push({
      level: 'info',
      message: {
        fr: 'Génération en L1 : vous devez définir tous les paramètres manuellement avant lancement.',
        en: 'Generation at L1: you must define all parameters manually before launch.',
      },
    });
  }
  return out;
}
