import { useMemo, useState } from 'react';
import { useLangStore } from '@/i18n';
import { glossary } from '@/config/glossary';

const LAYER_COLOR: Record<string, string> = {
  Framework: 'bg-human/15 text-human',
  L1: 'bg-amber-500/15 text-status-warning',
  L2: 'bg-cyan-500/15 text-agent-retrieval',
  'L2/L3': 'bg-cyan-500/15 text-agent-retrieval',
  'L2/L4': 'bg-lime-500/15 text-agent-doc',
  L3: 'bg-slate-500/15 text-status-simulated',
  L4: 'bg-violet-500/15 text-fbs-structure',
};

export default function E8Glossary() {
  const lang = useLangStore((s) => s.lang);
  const [q, setQ] = useState('');

  const filtered = useMemo(() => {
    const needle = q.trim().toLowerCase();
    if (!needle) return glossary;
    return glossary.filter(
      (t) =>
        t.term.toLowerCase().includes(needle) ||
        t.def[lang].toLowerCase().includes(needle) ||
        t.layer.toLowerCase().includes(needle),
    );
  }, [q, lang]);

  return (
    <div className="mx-auto max-w-app px-4 py-6">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h1 className="text-screen font-semibold">{lang === 'fr' ? 'Glossaire' : 'Glossary'}</h1>
        <input
          className="input max-w-xs"
          placeholder={lang === 'fr' ? 'Filtrer les termes…' : 'Filter terms…'}
          value={q}
          onChange={(e) => setQ(e.target.value)}
        />
      </div>
      <div className="mt-1 text-caption text-text-muted">
        {filtered.length} / {glossary.length} {lang === 'fr' ? 'termes' : 'terms'}
      </div>

      <div className="mt-4 grid grid-cols-1 gap-3 md:grid-cols-2 xl:grid-cols-3">
        {filtered.map((t) => (
          <div key={t.n} className="card p-3">
            <div className="flex items-center justify-between">
              <span className="text-body font-semibold text-text-primary">{t.term}</span>
              <span className={`pill ${LAYER_COLOR[t.layer] ?? 'bg-surface-overlay text-text-muted'}`}>{t.layer}</span>
            </div>
            <p className="mt-1.5 text-caption text-text-secondary">{t.def[lang]}</p>
            {t.example && <p className="mt-1 text-caption italic text-text-muted">{t.example[lang]}</p>}
          </div>
        ))}
        {filtered.length === 0 && (
          <div className="col-span-full py-8 text-center text-text-muted">
            {lang === 'fr' ? 'Aucun terme trouvé.' : 'No term found.'}
          </div>
        )}
      </div>
    </div>
  );
}
