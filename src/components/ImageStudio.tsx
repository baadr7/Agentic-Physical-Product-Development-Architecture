import { useEffect, useRef, useState } from 'react';
import { ImageIcon, Sparkles, RotateCcw, ExternalLink, AlertTriangle } from 'lucide-react';
import { useLangStore } from '@/i18n';
import { useAppState } from '@/store/appState';
import { useBackendStore } from '@/store/backend';
import { createProject, getConceptImages, postConceptImage, type ConceptImage } from '@/api/client';
import { defaultPromptFromSpec, pollinationsUrl, randomSeed } from '@/lib/pollinations';
import type { Concept } from '@/types';

interface Iteration {
  id: string;
  iteration: number;
  prompt: string;
  imageUrl: string;
  seed: number;
  kind: 'procedural' | 'ai';
}

// Map a persisted image to a session iteration. Older records may lack a stored
// URL (or were procedural) — rebuild one from the prompt so they still display.
function toIteration(i: ConceptImage): Iteration {
  const seed = (i.params as { seed?: number } | null)?.seed ?? 0;
  return {
    id: i.id,
    iteration: i.iteration,
    prompt: i.prompt,
    imageUrl: i.imageUrl ?? pollinationsUrl(i.prompt, { seed }),
    seed,
    kind: i.kind,
  };
}

/**
 * Per-concept image studio. The prompt is sent to a text-to-image model
 * (Pollinations AI, Flux) which generates exactly what the prompt describes.
 * Each generation is an iteration in a session (persisted to the backend when
 * available, in-memory otherwise — the image itself is always generated live).
 */
export default function ImageStudio({ concept }: { concept: Concept }) {
  const lang = useLangStore((s) => s.lang);
  const fr = lang === 'fr';
  const productName = useAppState((s) => s.brief.name);
  const [prompt, setPrompt] = useState(() => defaultPromptFromSpec(concept, productName, lang));
  const [session, setSession] = useState<Iteration[]>([]);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [imgState, setImgState] = useState<'idle' | 'loading' | 'ready' | 'error'>('idle');
  const [source, setSource] = useState<'backend' | 'offline' | null>(null);
  const loadedFor = useRef<string | null>(null);

  // Ensure a project, then load any existing session for this concept. Attempts
  // the backend directly (no probe gating) so a fast click can't miss it.
  useEffect(() => {
    if (loadedFor.current === concept.id) return;
    loadedFor.current = concept.id;
    let alive = true;
    (async () => {
      const pid = await ensureProjectId();
      if (!alive || !pid) return;
      try {
        const imgs = await getConceptImages(pid, concept.id);
        if (!alive || imgs.length === 0) return;
        const its = imgs.map(toIteration);
        setSession(its);
        setSelectedId(its[its.length - 1].id);
        setPrompt(its[its.length - 1].prompt);
        setSource('backend');
      } catch {
        /* leave the local preview */
      }
    })();
    return () => {
      alive = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [concept.id]);

  // Returns a backend project id, creating one if needed. null if the API is down.
  async function ensureProjectId(): Promise<string | null> {
    const bs = useBackendStore.getState();
    if (bs.projectId) return bs.projectId;
    try {
      const scenario = useAppState.getState().scenario;
      const sid = scenario && /^S[1-6]$/.test(scenario) ? scenario : null;
      const proj = await createProject(sid, useAppState.getState().brief);
      bs.setProjectId(proj.id);
      bs.setOnline(true);
      return proj.id;
    } catch {
      bs.setOnline(false);
      return null;
    }
  }

  function appendOffline(it: Iteration) {
    setSession((s) => {
      const next = { ...it, iteration: s.length + 1 };
      setSelectedId(next.id);
      return [...s, next];
    });
    setSource('offline');
  }

  async function generate() {
    const text = prompt.trim();
    if (!text) return;
    const seed = randomSeed();
    const imageUrl = pollinationsUrl(text, { seed });
    setLoading(true);
    try {
      const pid = await ensureProjectId();
      if (pid) {
        const { session: srv } = await postConceptImage(pid, concept.id, {
          prompt: text,
          params: { seed },
          kind: 'ai',
          imageUrl,
        });
        const its = srv.map(toIteration);
        setSession(its);
        setSelectedId(its[its.length - 1].id);
        setSource('backend');
        return;
      }
      appendOffline({ id: crypto.randomUUID(), iteration: 0, prompt: text, imageUrl, seed, kind: 'ai' });
    } catch {
      appendOffline({ id: crypto.randomUUID(), iteration: 0, prompt: text, imageUrl, seed, kind: 'ai' });
    } finally {
      setLoading(false);
    }
  }

  const selected = session.find((i) => i.id === selectedId) ?? null;
  const currentUrl = selected?.imageUrl ?? null;

  // Drive the per-image load state whenever the displayed image changes.
  useEffect(() => {
    setImgState(currentUrl ? 'loading' : 'idle');
  }, [currentUrl]);

  return (
    <div className="card mt-4 p-4">
      <div className="flex flex-wrap items-center gap-2">
        <ImageIcon size={15} className="text-text-secondary" />
        <h2 className="text-section font-semibold">{fr ? "Studio d'image (IA)" : 'Image studio (AI)'}</h2>
        {source && (
          <span className={`pill ${source === 'backend' ? 'bg-emerald-500/15 text-status-pass' : 'bg-amber-500/15 text-status-warning'}`}>
            <span className={`h-1.5 w-1.5 rounded-full ${source === 'backend' ? 'bg-status-pass' : 'bg-status-warning'}`} />
            {source === 'backend'
              ? fr ? 'Archivée dans le projet' : 'Archived to project'
              : fr ? 'Hors-ligne — non archivée' : 'Offline — not archived'}
          </span>
        )}
        <span className="ml-auto text-caption text-text-muted">
          {session.length > 0
            ? fr ? `${session.length} itération(s)` : `${session.length} iteration(s)`
            : fr ? 'Générée à partir du prompt' : 'Generated from the prompt'}
        </span>
      </div>

      {source === 'offline' && (
        <div className="mt-2 rounded border border-status-warning/40 bg-amber-500/10 p-2 text-caption text-status-warning">
          {fr
            ? "API hors-ligne : l'image est générée mais n'est pas enregistrée dans le dossier du projet. Démarrez le backend (npm run dev:all) puis régénérez pour l'archiver."
            : 'API offline: the image is generated but not saved to the project folder. Start the backend (npm run dev:all), then regenerate to archive it.'}
        </div>
      )}

      <div className="mt-3 grid grid-cols-1 gap-4 lg:grid-cols-[1.4fr_1fr]">
        {/* render */}
        <div>
          <div className="relative grid aspect-square w-full place-items-center overflow-hidden rounded-lg border border-border bg-surface-overlay">
            {currentUrl ? (
              <>
                <img
                  key={currentUrl}
                  src={currentUrl}
                  alt={selected?.prompt ?? ''}
                  className={`h-full w-full object-cover transition-opacity ${imgState === 'ready' ? 'opacity-100' : 'opacity-0'}`}
                  onLoad={() => setImgState('ready')}
                  onError={() => setImgState('error')}
                />
                {imgState === 'loading' && (
                  <div className="absolute inset-0 grid place-items-center gap-2 text-center">
                    <Sparkles size={22} className="animate-pulse text-text-secondary" />
                    <span className="text-caption text-text-muted">{fr ? "Génération de l'image…" : 'Generating image…'}</span>
                  </div>
                )}
                {imgState === 'error' && (
                  <div className="absolute inset-0 grid place-items-center gap-2 p-4 text-center">
                    <AlertTriangle size={22} className="text-status-warning" />
                    <span className="text-caption text-text-muted">
                      {fr ? "Échec de génération. Vérifiez la connexion puis réessayez." : 'Generation failed. Check your connection and retry.'}
                    </span>
                  </div>
                )}
              </>
            ) : (
              <div className="grid place-items-center gap-2 p-6 text-center">
                <ImageIcon size={26} className="text-text-muted" />
                <span className="text-caption text-text-muted">
                  {fr ? 'Décrivez votre image puis cliquez sur « Générer ».' : 'Describe your image, then click “Generate”.'}
                </span>
              </div>
            )}
          </div>
          {selected && (
            <div className="mt-2 flex flex-wrap items-center gap-1.5">
              <Pill>seed {selected.seed}</Pill>
              <Pill>Flux</Pill>
              <a
                href={selected.imageUrl}
                target="_blank"
                rel="noreferrer"
                className="pill ml-auto inline-flex items-center gap-1 bg-surface-overlay text-text-secondary hover:text-text-primary"
              >
                <ExternalLink size={11} />
                {fr ? 'Ouvrir' : 'Open'}
              </a>
            </div>
          )}
        </div>

        {/* prompt + controls */}
        <div className="flex flex-col">
          <label className="text-caption uppercase tracking-wide text-text-muted">
            {fr ? 'Prompt image' : 'Image prompt'}
          </label>
          <textarea
            value={prompt}
            onChange={(e) => setPrompt(e.target.value)}
            rows={5}
            placeholder={fr ? "Décrivez précisément l'image à générer…" : 'Describe exactly the image to generate…'}
            className="input mt-1 resize-none font-mono text-caption leading-relaxed"
          />
          <p className="mt-1 text-caption text-text-muted">
            {fr
              ? "L'image est générée exactement à partir de votre texte (Pollinations AI · Flux). Chaque génération utilise une graine aléatoire."
              : 'The image is generated exactly from your text (Pollinations AI · Flux). Each generation uses a random seed.'}
          </p>
          <div className="mt-2 flex gap-2">
            <button onClick={generate} disabled={loading || !prompt.trim()} className="btn-primary flex-1">
              <Sparkles size={14} className={loading ? 'animate-pulse' : ''} />
              {session.length === 0
                ? fr ? "Générer l'image" : 'Generate image'
                : fr ? 'Générer à nouveau' : 'Generate again'}
            </button>
            <button
              onClick={() => setPrompt(defaultPromptFromSpec(concept, productName, lang))}
              className="btn-ghost"
              title={fr ? 'Réinitialiser le prompt' : 'Reset prompt'}
            >
              <RotateCcw size={14} />
            </button>
          </div>

          {/* session history */}
          {session.length > 0 && (
            <div className="mt-3">
              <div className="text-caption uppercase tracking-wide text-text-muted">
                {fr ? 'Historique de session' : 'Session history'}
              </div>
              <div className="mt-1.5 flex flex-wrap gap-2">
                {session.map((it) => (
                  <button
                    key={it.id}
                    onClick={() => {
                      setSelectedId(it.id);
                      setPrompt(it.prompt);
                    }}
                    title={it.prompt}
                    className={`overflow-hidden rounded-md border ${it.id === selectedId ? 'border-human' : 'border-border'} transition-colors`}
                  >
                    <img src={it.imageUrl} alt="" loading="lazy" className="h-[54px] w-[80px] object-cover" />
                    <div className="bg-surface-overlay px-1 py-0.5 text-center text-[10px] text-text-secondary">#{it.iteration}</div>
                  </button>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

function Pill({ children }: { children: React.ReactNode }) {
  return <span className="pill bg-surface-overlay text-text-secondary">{children}</span>;
}
