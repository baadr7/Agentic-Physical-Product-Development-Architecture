import { useMemo, useState } from 'react';
import { useLangStore } from '@/i18n';
import { useAppState } from '@/store/appState';
import { AGENT_COLOR } from './AgentCard';
import type { ADTEntry, AgentId } from '@/types';

const COLOR: Record<string, string> = { ...AGENT_COLOR, human: '#3B82F6', system: '#64748B' };

export default function ADTTimeline({
  showFilter = true,
  showExport = false,
  maxHeight = '32rem',
  onExport,
}: {
  showFilter?: boolean;
  showExport?: boolean;
  maxHeight?: string;
  onExport?: () => void;
}) {
  const lang = useLangStore((s) => s.lang);
  const adt = useAppState((s) => s.adt);
  const [filter, setFilter] = useState<string>('all');

  const agentsPresent = useMemo(() => Array.from(new Set(adt.map((e) => e.agent))), [adt]);
  const entries = filter === 'all' ? adt : adt.filter((e) => e.agent === filter);

  return (
    <div className="card flex flex-col">
      <div className="flex items-center justify-between border-b border-border px-3 py-2">
        <div className="text-body font-semibold">
          {lang === 'fr' ? 'Thread numérique (ADT)' : 'Digital thread (ADT)'}
          <span className="ml-2 pill bg-surface-overlay text-text-muted">{adt.length}</span>
        </div>
        <div className="flex items-center gap-2">
          {showFilter && (
            <select
              value={filter}
              onChange={(e) => setFilter(e.target.value)}
              className="rounded border border-border bg-surface px-2 py-1 text-caption text-text-secondary"
            >
              <option value="all">{lang === 'fr' ? 'Tous' : 'All'}</option>
              {agentsPresent.map((a) => (
                <option key={a} value={a}>
                  {a}
                </option>
              ))}
            </select>
          )}
          {showExport && (
            <button onClick={onExport} className="text-caption text-human hover:underline">
              {lang === 'fr' ? 'Exporter' : 'Export'}
            </button>
          )}
        </div>
      </div>

      <div className="overflow-auto px-3 py-2" style={{ maxHeight }}>
        {entries.length === 0 ? (
          <div className="py-6 text-center text-caption text-text-muted">
            {lang === 'fr' ? 'Aucune entrée pour l’instant.' : 'No entries yet.'}
          </div>
        ) : (
          <ol className="relative ml-2 border-l border-border">
            {entries.map((e) => (
              <ADTRow key={e.id} entry={e} />
            ))}
          </ol>
        )}
      </div>
    </div>
  );
}

function ADTRow({ entry }: { entry: ADTEntry }) {
  const color = COLOR[entry.agent as AgentId] ?? '#64748B';
  const time = new Date(entry.timestamp).toLocaleTimeString();
  return (
    <li className="relative mb-3 pl-4">
      <span
        className="absolute -left-[5px] top-1 h-2 w-2 rounded-full ring-2 ring-surface-raised"
        style={{ backgroundColor: color }}
      />
      <div className="flex items-center gap-2">
        <span className="text-body font-medium text-text-primary">{entry.event}</span>
        {entry.hitlLevel != null && (
          <span className="pill bg-human/15 text-human">L{entry.hitlLevel}</span>
        )}
      </div>
      <div className="flex flex-wrap items-center gap-x-2 text-caption text-text-muted">
        <span style={{ color }}>{entry.agent}</span>
        <span>·</span>
        <span>{entry.source}</span>
        <span>·</span>
        <span className="mono">{time}</span>
      </div>
    </li>
  );
}
