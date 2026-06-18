import { useState } from 'react';
import { useLangStore } from '@/i18n';
import { useAppState } from '@/store/appState';
import { LLM_MODEL } from '@/llm/deepseek';

export default function SettingsModal({ onClose }: { onClose: () => void }) {
  const lang = useLangStore((s) => s.lang);
  const apiKey = useAppState((s) => s.apiKey);
  const setApiKey = useAppState((s) => s.setApiKey);
  const [draft, setDraft] = useState(apiKey ?? '');

  const fr = lang === 'fr';

  function save() {
    setApiKey(draft.trim() || null);
    onClose();
  }

  return (
    <div className="fixed inset-0 z-50 grid place-items-center bg-black/60 p-4" onClick={onClose}>
      <div className="card-overlay w-full max-w-md p-5" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center justify-between">
          <h3 className="text-section font-semibold">{fr ? 'Paramètres' : 'Settings'}</h3>
          <span className="pill bg-surface-overlay text-text-muted">{LLM_MODEL}</span>
        </div>

        <p className="mt-2 text-body text-text-secondary">
          {fr
            ? 'Clé API DeepSeek (interface compatible OpenAI). Conservée en mémoire uniquement — jamais persistée ni journalisée.'
            : 'DeepSeek API key (OpenAI-compatible). Kept in memory only — never persisted or logged.'}
        </p>

        <label className="mt-3 block">
          <span className="text-caption text-text-secondary">{fr ? 'Clé API' : 'API key'}</span>
          <input
            type="password"
            className="input mt-1 font-mono"
            placeholder="sk-…"
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            autoComplete="off"
          />
        </label>

        <div className="mt-3 flex items-center gap-2 rounded border border-border bg-surface p-2.5">
          <span
            className={`h-2 w-2 rounded-full ${draft.trim() ? 'bg-status-pass' : 'bg-status-warning'}`}
          />
          <span className="text-caption text-text-secondary">
            {draft.trim()
              ? fr
                ? 'Appels réels DeepSeek (validés par zod, repli mock si échec).'
                : 'Real DeepSeek calls (zod-validated, mock fallback on failure).'
              : fr
                ? 'Aucune clé : mode démo — réponses simulées réalistes, hors-ligne.'
                : 'No key: demo mode — realistic simulated responses, offline.'}
          </span>
        </div>

        <div className="mt-4 flex justify-end gap-2">
          {apiKey && (
            <button
              onClick={() => {
                setApiKey(null);
                setDraft('');
              }}
              className="btn-ghost"
            >
              {fr ? 'Effacer la clé' : 'Clear key'}
            </button>
          )}
          <button onClick={onClose} className="btn-ghost">
            {fr ? 'Annuler' : 'Cancel'}
          </button>
          <button onClick={save} className="btn-primary">
            {fr ? 'Enregistrer' : 'Save'}
          </button>
        </div>
      </div>
    </div>
  );
}
