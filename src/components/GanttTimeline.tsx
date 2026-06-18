import { useLangStore } from '@/i18n';
import { AGENT_CONFIG, pick } from '@/config/hitlMatrix';
import { AGENT_COLOR } from './AgentCard';
import type { AgentId, AgentRuntime } from '@/types';

const ROW_ORDER: AgentId[] = ['orchestrator', 'retrieval', 'generation', 'simulation', 'dfx', 'doc'];
// nominal plan durations (s) for layout
const DUR: Record<AgentId, number> = { orchestrator: 8, retrieval: 12, generation: 18, simulation: 15, dfx: 9, doc: 6 };
const DFX5 = ['DFM', 'DFA', 'DFR', 'DFC', 'DFS'];

export default function GanttTimeline({ agents }: { agents: Record<AgentId, AgentRuntime> }) {
  const lang = useLangStore((s) => s.lang);
  // cumulative start offsets (sequential)
  let offset = 0;
  const total = ROW_ORDER.reduce((a, id) => a + DUR[id], 0);
  const layout = ROW_ORDER.map((id) => {
    const start = offset;
    offset += DUR[id];
    return { id, start, dur: DUR[id] };
  });

  return (
    <div className="card p-3">
      <div className="mb-2 text-caption font-semibold uppercase tracking-wide text-text-muted">
        {lang === 'fr' ? 'Chronologie d’exécution' : 'Execution timeline'}
      </div>
      <div className="space-y-1.5">
        {layout.map(({ id, start, dur }) => {
          const st = agents[id].status;
          const color = AGENT_COLOR[id];
          const opacity = st === 'done' ? 1 : st === 'running' ? 0.7 : 0.25;
          return (
            <div key={id} className="flex items-center gap-2">
              <span className="w-24 shrink-0 truncate text-caption text-text-secondary">
                {pick(AGENT_CONFIG[id].label, lang)}
              </span>
              <div className="relative h-5 flex-1 rounded bg-surface">
                {id === 'dfx' ? (
                  <div
                    className="absolute inset-y-0 flex gap-0.5"
                    style={{ left: `${(start / total) * 100}%`, width: `${(dur / total) * 100}%` }}
                  >
                    {DFX5.map((d) => (
                      <div
                        key={d}
                        className="grid flex-1 place-items-center rounded text-[8px] font-bold text-white"
                        style={{ backgroundColor: color, opacity }}
                        title={d}
                      >
                        {d}
                      </div>
                    ))}
                  </div>
                ) : (
                  <div
                    className="absolute inset-y-0 grid place-items-center rounded text-[9px] font-medium text-white"
                    style={{
                      left: `${(start / total) * 100}%`,
                      width: `${(dur / total) * 100}%`,
                      backgroundColor: color,
                      opacity,
                    }}
                  >
                    {dur}s
                  </div>
                )}
                {st === 'running' && (
                  <div className="absolute inset-0 animate-pulse rounded ring-1 ring-inset ring-white/30" />
                )}
              </div>
            </div>
          );
        })}
      </div>
      <div className="mt-2 text-right text-caption text-text-muted">
        {lang === 'fr' ? 'DFx ×5 exécutés en parallèle' : 'DFx ×5 run in parallel'}
      </div>
    </div>
  );
}
