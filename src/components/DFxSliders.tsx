import { useLangStore } from '@/i18n';
import type { DFxScores } from '@/types';

const ROWS: { key: keyof DFxScores; label: string; full: { fr: string; en: string }; accent?: boolean }[] = [
  { key: 'dfm', label: 'DFM', full: { fr: 'Fabricabilité', en: 'Manufacturability' } },
  { key: 'dfa', label: 'DFA', full: { fr: 'Assemblage', en: 'Assembly' } },
  { key: 'dfr', label: 'DFR', full: { fr: 'Fiabilité', en: 'Reliability' } },
  { key: 'dfc', label: 'DFC', full: { fr: 'Coût', en: 'Cost' } },
  { key: 'dfs', label: 'DFS', full: { fr: 'Durabilité', en: 'Sustainability' }, accent: true },
];

export default function DFxSliders({
  values,
  onChange,
}: {
  values: DFxScores;
  onChange: (key: keyof DFxScores, value: number) => void;
}) {
  const lang = useLangStore((s) => s.lang);
  return (
    <div className="space-y-2.5">
      {ROWS.map((r) => (
        <div key={r.key} className="flex items-center gap-3">
          <div className="w-32 shrink-0">
            <span className={`text-body font-semibold ${r.accent ? 'text-dfs' : 'text-text-primary'}`}>
              {r.label}
            </span>
            <span className="ml-1 text-caption text-text-muted">{r.full[lang]}</span>
          </div>
          <input
            type="range"
            min={1}
            max={5}
            step={1}
            value={values[r.key]}
            onChange={(e) => onChange(r.key, Number(e.target.value))}
            className="h-1.5 flex-1 cursor-pointer appearance-none rounded bg-border accent-human"
            style={r.accent ? { accentColor: '#10B981' } : undefined}
          />
          <div className="flex w-20 justify-end gap-0.5">
            {[1, 2, 3, 4, 5].map((n) => (
              <span
                key={n}
                className={`h-4 w-3 rounded-sm ${
                  n <= values[r.key]
                    ? r.accent
                      ? 'bg-dfs'
                      : 'bg-human'
                    : 'bg-surface-overlay'
                }`}
              />
            ))}
          </div>
          <span className="mono tnum w-4 text-right text-text-primary">{values[r.key]}</span>
        </div>
      ))}
    </div>
  );
}
