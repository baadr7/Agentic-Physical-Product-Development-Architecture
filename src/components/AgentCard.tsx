import { useLangStore } from '@/i18n';
import { AGENT_CONFIG, pick } from '@/config/hitlMatrix';
import { AGENT_ICON } from './icons';
import type { AgentId, AgentRuntime, HITLLevel } from '@/types';

const AGENT_COLOR: Record<AgentId, string> = {
  orchestrator: '#F59E0B',
  retrieval: '#06B6D4',
  generation: '#EC4899',
  simulation: '#6366F1',
  dfx: '#10B981',
  doc: '#84CC16',
};

const LAYER: Record<AgentId, string> = {
  orchestrator: 'L2',
  retrieval: 'L2',
  generation: 'L2',
  simulation: 'L2',
  dfx: 'L2',
  doc: 'L2/L4',
};

function mmss(ms: number) {
  const s = Math.floor(ms / 1000);
  return `${String(Math.floor(s / 60)).padStart(2, '0')}:${String(s % 60).padStart(2, '0')}`;
}

export default function AgentCard({
  agent,
  runtime,
  level,
  onOpen,
  review = false,
}: {
  agent: AgentId;
  runtime: AgentRuntime;
  level: HITLLevel;
  onOpen?: () => void;
  review?: boolean;
}) {
  const lang = useLangStore((s) => s.lang);
  const color = AGENT_COLOR[agent];
  const dot =
    runtime.status === 'running'
      ? 'bg-status-running animate-pulse'
      : runtime.status === 'done'
        ? 'bg-status-pass'
        : runtime.status === 'error'
          ? 'bg-status-redesign'
          : 'bg-text-muted';

  return (
    <button
      onClick={onOpen}
      className={`card relative overflow-hidden p-3 text-left transition-colors hover:border-border-strong ${
        review ? 'border-human ring-1 ring-human/50' : ''
      }`}
      style={{ borderLeft: `3px solid ${color}` }}
    >
      {review && (
        <span className="absolute right-2 top-2 z-10 inline-flex items-center gap-1 rounded bg-human px-1.5 py-0.5 text-[10px] font-semibold text-white">
          <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-white" />
          {lang === 'fr' ? 'à valider' : 'review'}
        </span>
      )}
      {runtime.status === 'running' && (
        <div className="absolute inset-x-0 top-0 h-0.5 overflow-hidden">
          <div className="h-full w-1/3 animate-shimmer" style={{ backgroundColor: color }} />
        </div>
      )}
      <div className="flex items-start justify-between">
        <div>
          <div className="flex items-center gap-1.5">
            {(() => {
              const Ic = AGENT_ICON[agent];
              return <Ic size={15} style={{ color }} strokeWidth={2} />;
            })()}
            <span className="text-body font-semibold text-text-primary">{pick(AGENT_CONFIG[agent].label, lang)}</span>
          </div>
          <div className="mt-0.5 flex items-center gap-1">
            <span className="pill bg-surface-overlay text-text-muted">{LAYER[agent]}</span>
            <span className="pill bg-human/15 text-human">HITL L{level}</span>
          </div>
        </div>
        <div className="flex items-center gap-1.5">
          <span className={`h-2 w-2 rounded-full ${dot}`} />
          <span className="mono tnum text-text-muted">{mmss(runtime.elapsedMs)}</span>
        </div>
      </div>

      <div className="mt-2 h-[3.2rem] space-y-0.5 overflow-hidden font-mono text-[10px] leading-tight text-text-muted">
        {runtime.logs.length === 0 ? (
          <div className="text-text-muted/50">{lang === 'fr' ? 'en attente…' : 'idle…'}</div>
        ) : (
          runtime.logs.slice(-3).map((l, i) => <div key={i} className="truncate">› {l}</div>)
        )}
      </div>
    </button>
  );
}

export { AGENT_COLOR };
