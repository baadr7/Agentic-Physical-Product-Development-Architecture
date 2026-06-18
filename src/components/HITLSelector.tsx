import { useLangStore } from '@/i18n';
import { AGENT_CONFIG, HITL_MATRIX, ROLE_TITLE, pick } from '@/config/hitlMatrix';
import type { AgentId, HITLLevel } from '@/types';

const LEVELS: HITLLevel[] = [1, 2, 3, 4, 5];

/**
 * 5 segmented buttons (disabled outside the allowed range). On change, shows two
 * zones: agent (grey) and human (blue highlighted), plus the available action.
 */
export default function HITLSelector({
  agent,
  value,
  onChange,
  compact = false,
}: {
  agent: AgentId;
  value: HITLLevel;
  onChange: (l: HITLLevel) => void;
  compact?: boolean;
}) {
  const lang = useLangStore((s) => s.lang);
  const cfg = AGENT_CONFIG[agent];
  const cell = HITL_MATRIX[agent][value];

  return (
    <div className="card p-3">
      <div className="flex items-center justify-between gap-2">
        <div>
          <div className="text-body font-semibold text-text-primary">{pick(cfg.label, lang)}</div>
          <div className="text-caption text-text-muted">{pick(cfg.reason, lang)}</div>
        </div>
        <span className="pill bg-human/15 text-human">{pick(ROLE_TITLE[value], lang)}</span>
      </div>

      <div className="mt-2 grid grid-cols-5 gap-1">
        {LEVELS.map((l) => {
          const allowed = l >= cfg.min && l <= cfg.max;
          const active = l === value;
          return (
            <button
              key={l}
              disabled={!allowed}
              onClick={() => allowed && onChange(l)}
              className={`rounded py-1.5 text-caption font-semibold transition-colors ${
                active
                  ? 'bg-human text-white'
                  : allowed
                    ? 'bg-surface text-text-secondary hover:bg-surface-overlay'
                    : 'cursor-not-allowed bg-surface/40 text-text-muted/40'
              }`}
              title={allowed ? `L${l}` : 'Hors plage autorisée'}
            >
              L{l}
            </button>
          );
        })}
      </div>

      {!compact && (
        <div className="mt-3 space-y-2">
          <div className="rounded border border-border bg-surface px-2.5 py-1.5">
            <div className="text-caption font-semibold uppercase tracking-wide text-ai">
              {lang === 'fr' ? "Ce que fait l'agent" : 'What the agent does'}
            </div>
            <div className="text-body text-text-secondary">{pick(cell.agent, lang)}</div>
          </div>
          <div className="rounded border border-human/40 bg-human/10 px-2.5 py-1.5">
            <div className="text-caption font-semibold uppercase tracking-wide text-human">
              {lang === 'fr' ? "Ce que doit faire l'humain" : 'What the human does'}
            </div>
            <div className="text-body text-text-primary">{pick(cell.human, lang)}</div>
          </div>
          <div className="text-caption text-text-muted">
            {lang === 'fr' ? 'Action disponible : ' : 'Available action: '}
            <span className="font-medium text-text-secondary">{pick(cell.action, lang)}</span>
          </div>
        </div>
      )}
    </div>
  );
}
