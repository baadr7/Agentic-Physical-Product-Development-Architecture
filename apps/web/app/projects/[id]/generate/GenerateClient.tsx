'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import { apiNormalizeBrief, apiCreateRun, apiGetProject, apiGetRun, apiGenerateImage, apiGenerateVariants } from '~/lib/api/fastapi';
import { useRouter } from 'next/navigation';

export default function GenerateClient({ projectId }: { projectId: string }) {
  const router = useRouter();
  const [guidance_scale, setGuidanceScale] = useState(7.5);
  const [seed, setSeed] = useState<number | ''>('');
  const [steps, setSteps] = useState(20);
  const [preset, setPreset] = useState('metal_and_fabric');
  const [widthPx, setWidthPx] = useState<number>(1080);
  const [heightPx, setHeightPx] = useState<number>(1080);
  const [sizeCm, setSizeCm] = useState<number>(5);
  const [widthMm, setWidthMm] = useState<number | ''>('');
  const [heightMm, setHeightMm] = useState<number | ''>('');
  const [depthMm, setDepthMm] = useState<number | ''>('');
  const [brief, setBrief] = useState('');
  const [normalized, setNormalized] = useState<any | null>(null);
  const [normBadges, setNormBadges] = useState<{ label: string; value?: string | number }[]>([]);
  const [normalizing, setNormalizing] = useState(false);
  const [normalizeError, setNormalizeError] = useState<string | null>(null);
  const [appliedNotice, setAppliedNotice] = useState<string | null>(null);
  const [isGenerating, setIsGenerating] = useState(false);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [activeRunId, setActiveRunId] = useState<string | null>(null);
  const [previewPersistedUrl, setPreviewPersistedUrl] = useState<string | null>(null);
  const [previewPersisted, setPreviewPersisted] = useState<boolean | null>(null);
  const [progress, setProgress] = useState(0);
  const [logs, setLogs] = useState<string[]>(['Prêt à générer...']);
  const [materialsText, setMaterialsText] = useState('');
  const [constraintsJson, setConstraintsJson] = useState<Record<string, unknown> | null>(null);
  const pollRef = useRef<number | null>(null);
  const stubMode = useMemo(() => (process.env.NEXT_PUBLIC_STUB_MODE || '').trim() === '1', []);

  const snapTo8 = (value: number, min = 128, max = 2048) => {
    const v = Math.max(min, Math.min(max, Math.floor(Number(value) || min)));
    return Math.max(8, Math.floor(v / 8) * 8);
  };

  // Prefill brief from project so the Generate page is immediately usable.
  useEffect(() => {
    let mounted = true;
    (async () => {
      try {
        const p: any = await apiGetProject(projectId);
        if (!mounted || !p) return;
        const prefill = String(p.brief || p.description || '').trim();
        if (prefill && !brief.trim()) setBrief(prefill);
      } catch {
        // ignore, keep user input
      }
    })();
    return () => {
      mounted = false;
    };
    // only run once for this projectId
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [projectId]);

  useEffect(() => {
    return () => {
      if (pollRef.current) {
        window.clearInterval(pollRef.current);
        pollRef.current = null;
      }
    };
  }, []);

  const handleGenerate = async () => {
    setIsGenerating(true);
    setProgress(0);
    setLogs(['🎬 Démarrage de la génération...', 'Appel API: création du run']);

    // Try backend API first; if unavailable, fall back to simulated flow
    try {
      // Build constraints from materials and normalized constraints (if any)
      const materials = materialsText
        .split(/\n|,/) // split by newline or comma
        .map((s) => s.trim())
        .filter(Boolean);
      const constraints = {
        ...(constraintsJson || {}),
        ...(materials.length ? { materials } : {}),
      } as Record<string, unknown>;

      const payload = {
        project_id: projectId,
        input_mode: 'text',
        description: brief,
        constraints,
        options: {
          guidance_scale,
          ...(typeof seed === 'number' && !Number.isNaN(seed) ? { seed } : {}),
          steps,
          preset,
          width: widthPx,
          height: heightPx,
          size_cm: sizeCm,
          width_mm: typeof widthMm === 'number' ? widthMm : undefined,
          height_mm: typeof heightMm === 'number' ? heightMm : undefined,
          depth_mm: typeof depthMm === 'number' ? depthMm : undefined,
        },
      };

      // Create a run. We generate variants synchronously from the UI, so avoid background processing here.
      const data = await apiCreateRun({ ...(payload as any), skip_processing: true } as any);
      const runId: string = data.run_id;
      setActiveRunId(runId);
      setLogs((prev) => [...prev, `Run créé: ${runId}`, '🎨 Génération des variantes (images)...']);
      setProgress(25);

      if (stubMode) {
        // In stub mode the run is already completed immediately by the route.
        setProgress(100);
        setLogs((prev) => [...prev, '✅ (stub) Génération instantanée']);
        setIsGenerating(false);
        router.push(`/projects/${projectId}/results`);
        return;
      }

      // Trigger real variant generation so Results page is never empty.
      // Keep preview sizes reasonable for faster UX.
      // NOTE: Local CPU diffusers is extremely slow at high resolution.
      // Use a conservative max size so the Results polling can actually pick up variants.
      const genW = snapTo8(Math.min(512, Number(widthPx) || 512), 128, 512);
      const genH = snapTo8(Math.min(512, Number(heightPx) || 512), 128, 512);
      try {
        setProgress(50);
        const res = await apiGenerateVariants(runId, {
          count: 4,
          width: genW,
          height: genH,
          ...(typeof seed === 'number' && !Number.isNaN(seed) ? { seed } : {}),
          guidance_scale,
          steps,
          // Avoid long blocking requests; Results page will poll until variants appear.
          enqueue: true,
          // Only include inline base64 if needed later; URLs are preferred.
          include_image_b64: false,
        });
        const queued = Boolean(res?.queued);
        const n = Array.isArray(res?.variants) ? res.variants.length : 0;
        setProgress(95);
        if (queued) {
          setLogs((prev) => [...prev, '🧵 Variantes en file (async)...', 'Redirection vers Résultats...']);
        } else {
          setLogs((prev) => [...prev, `✅ Variantes générées: ${n}`, 'Redirection vers Résultats...']);
        }
      } catch (e: any) {
        setLogs((prev) => [...prev, `❌ Échec génération variantes: ${e?.message || e}`, 'Reste sur la page (aucune redirection).']);
        setIsGenerating(false);
        return;
      }

      setProgress(100);
      setIsGenerating(false);
      router.push(`/projects/${projectId}/results`);
    } catch (err: any) {
      // Important: do NOT simulate and redirect on real API failures.
      // That leads to mock/placeholder variants that don't match the user's brief.
      const msg = err?.message || String(err);
      setLogs((prev) => [
        ...prev,
        `❌ Échec API: ${msg}`,
        'Vérifie que FastAPI tourne sur http://127.0.0.1:8000 et que NEXT_PUBLIC_API_BASE_URL est correct.',
        'Aucune redirection vers Résultats (pour éviter des images de démo).',
      ]);
      setIsGenerating(false);
      setProgress(0);
      return;
    }
  };

  const handlePreview = async () => {
    setPreviewUrl(null);
    setPreviewPersistedUrl(null);
    setPreviewPersisted(null);
    try {
      // If no run exists yet, create a lightweight preview run so previews
      // can be persisted server-side. Set `skip_processing` to avoid scheduling.
      if (!activeRunId) {
        try {
          const run = await apiCreateRun({ project_id: projectId, input_mode: 'text', description: 'Preview run', constraints: {}, options: {}, skip_processing: true } as any);
          setActiveRunId(run.run_id);
        } catch (e) {
          // ignore errors creating preview run; previews will still work without persistence
        }
      }

      const payload: any = {
        prompt: brief || 'Product photo',
        width: snapTo8(widthPx, 128, 2048),
        height: snapTo8(heightPx, 128, 2048),
        steps,
        guidance_scale,
      };
      if (typeof seed === 'number' && !Number.isNaN(seed)) {
        payload.seed = seed;
      }
      if (activeRunId) {
        payload.run_id = activeRunId;
      }
      payload.variant_id = 'var-preview-' + Math.random().toString(16).slice(2, 10);

      const res = await apiGenerateImage(payload as any);
      if (res.blobUrl) {
        setPreviewUrl(res.blobUrl);
        setLogs((prev) => [...prev, 'Preview image generated (binary)']);
        if (res.json && res.json.persisted) {
          setPreviewPersisted(true);
          setPreviewPersistedUrl(res.json.public_url || null);
          setLogs((prev) => [...prev, `Preview persisted to ${res.json.public_url}`]);
            // Refresh server-side data so variants/run list reflects the new persisted asset
            try {
              router.refresh();
            } catch (e) {}
        } else if (res.json && res.json.persisted === false) {
          setPreviewPersisted(false);
          setLogs((prev) => [...prev, 'Preview not persisted (no storage configured)']);
        }
      } else if (res.json && res.json.image_b64) {
        // create object URL from base64
        const b64 = res.json.image_b64;
        const bytes = Uint8Array.from(atob(b64), (c) => c.charCodeAt(0));
        const blob = new Blob([bytes], { type: 'image/png' });
        const url = URL.createObjectURL(blob);
        setPreviewUrl(url);
        setLogs((prev) => [...prev, 'Preview image generated (json->b64)']);
        if (res.json.persisted) {
          setPreviewPersisted(true);
          setPreviewPersistedUrl(res.json.public_url || null);
          setLogs((prev) => [...prev, `Preview persisted to ${res.json.public_url}`]);
          try { router.refresh(); } catch (e) {}
        } else if (res.json.persisted === false) {
          setPreviewPersisted(false);
          setLogs((prev) => [...prev, 'Preview not persisted (no storage configured)']);
        }
      } else {
        setLogs((prev) => [...prev, 'Preview generation returned no image']);
      }
    } catch (e: any) {
      setLogs((prev) => [...prev, `Preview failed: ${e?.message || e}`]);
    }
  };

  const handleNormalizeBrief = async () => {
    setNormalizeError(null);
    setNormalizing(true);
    try {
      const res = await apiNormalizeBrief(brief || '');
      if (!res.ok) {
        setNormalizeError('LLM non configuré (Hugging Face). Définissez HUGGINGFACE_API_KEY côté API.');
        setNormalized(null);
        return;
      }
      const data = (res as any).data ?? res;
      setNormalized(data);
      setLogs((prev) => [...prev, '🧠 Brief normalisé via LLM', JSON.stringify(data)]);
      // Optional: adopt size_cm if present
      const s = (data?.size_cm ?? data?.dimensions?.size_cm) as number | undefined;
      if (typeof s === 'number' && !Number.isNaN(s)) setSizeCm(Math.max(2, Math.min(20, Math.round(s))));
      // Map materials
      if (Array.isArray(data?.materials) && data.materials.length) {
        setMaterialsText(data.materials.join(', '));
      }
      // Collect dimension options if present
      const nWidth = data?.options?.width_mm ?? data?.dimensions?.width_mm;
      const nHeight = data?.options?.height_mm ?? data?.dimensions?.height_mm;
      const nDepth = data?.options?.depth_mm ?? data?.dimensions?.depth_mm;
      if (typeof nWidth === 'number') setWidthMm(Math.max(1, Math.round(nWidth)));
      if (typeof nHeight === 'number') setHeightMm(Math.max(1, Math.round(nHeight)));
      if (typeof nDepth === 'number') setDepthMm(Math.max(1, Math.round(nDepth)));
      // Build badges summary for quick visual feedback
      const badges: { label: string; value?: string | number }[] = [];
      if (Array.isArray(data?.materials) && data.materials.length) {
        badges.push({ label: `Matériaux: ${data.materials.join(', ')}` });
      }
      if (typeof nWidth === 'number' && typeof nHeight === 'number' && typeof nDepth === 'number') {
        badges.push({ label: 'Dimensions', value: `${Math.round(nWidth)}×${Math.round(nHeight)}×${Math.round(nDepth)} mm` });
      }
      // DfX weighting badges (top 4)
      if (data?.weighting && typeof data.weighting === 'object') {
        const entries = Object.entries(data.weighting as Record<string, number>)
          .sort((a, b) => (b[1] ?? 0) - (a[1] ?? 0))
          .slice(0, 4);
        for (const [k, v] of entries) {
          badges.push({ label: `DfX:${k}`, value: Math.round((v ?? 0) * 100) + '%' });
        }
      }
      setNormBadges(badges);
      // Capture constraints blob
      if (data?.constraints && typeof data.constraints === 'object') {
        setConstraintsJson(data.constraints as Record<string, unknown>);
      }
      // Tiny applied notice
      setAppliedNotice('Paramètres LLM appliqués');
      window.setTimeout(() => setAppliedNotice(null), 2500);
    } catch (e: any) {
      setNormalizeError(e?.message || 'Échec de la normalisation');
    } finally {
      setNormalizing(false);
    }
  };

  return (
    <div className="min-h-screen bg-slate-50">
      {/* Header */}
      <header className="bg-white shadow-sm border-b border-slate-200">
        <div className="max-w-7xl mx-auto px-6 py-6">
          <h1 className="text-3xl font-bold text-slate-900">Génération</h1>
          <p className="text-slate-600">Projet ID: {projectId}</p>
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-6 py-8">
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          {/* Left: Parameters */}
          <div className="lg:col-span-1">
            <div className="bg-white rounded-lg shadow-md p-6 border border-slate-200">
              <h2 className="text-xl font-bold text-slate-900 mb-6">Paramètres</h2>

              {/* Brief */}
              <div className="mb-6">
                <label className="block text-sm font-semibold text-slate-700 mb-2">
                  Brief / Description
                </label>
                <textarea
                  value={brief}
                  onChange={(e) => setBrief(e.target.value)}
                  rows={4}
                  placeholder="Décrivez votre intention, contraintes, matériaux, dimensions..."
                    className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                    data-testid="generate-brief-input"
                />
                <div className="flex items-center gap-2 mt-2">
                  <button
                    type="button"
                    onClick={handleNormalizeBrief}
                    disabled={!brief || normalizing}
                      className="bg-blue-600 hover:bg-blue-700 disabled:bg-slate-300 text-white text-sm font-semibold px-3 py-2 rounded"
                      data-testid="normalize-brief-btn"
                  >
                    {normalizing ? 'Normalisation…' : '🔎 Normaliser le brief (LLM)'}
                  </button>
                  {normalizeError && (
                    <span className="text-xs text-red-600">{normalizeError}</span>
                  )}
                </div>
                {normBadges.length > 0 && (
                  <div className="mt-3 flex flex-wrap gap-2">
                    {normBadges.map((b, idx) => (
                      <span key={idx} className="inline-flex items-center gap-1 px-2 py-1 rounded-full text-xs font-semibold bg-indigo-100 text-indigo-800 border border-indigo-200">
                        {b.label}{b.value !== undefined ? `: ${b.value}` : ''}
                      </span>
                    ))}
                  </div>
                )}
                {normalized && (
                  <pre className="mt-3 text-xs bg-slate-50 border border-slate-200 rounded p-3 overflow-x-auto">
{JSON.stringify(normalized, null, 2)}
                  </pre>
                )}
              </div>

              {/* Guidance Scale */}
              <div className="mb-6">
                <label className="block text-sm font-semibold text-slate-700 mb-2">
                  Guidance Scale: {guidance_scale.toFixed(1)}
                </label>
                <input
                  type="range"
                  min="1"
                  max="15"
                  step="0.5"
                  value={guidance_scale}
                  onChange={(e) => setGuidanceScale(parseFloat(e.target.value))}
                  className="w-full h-2 bg-slate-200 rounded-lg appearance-none cursor-pointer"
                />
                <p className="text-xs text-slate-500 mt-1">
                  Contrôle la strictesse du suivi du prompt
                </p>
                <div className="mt-3">
                  <label className="block text-sm font-semibold text-slate-700 mb-2">Résolution (px)</label>
                  <div className="flex items-center gap-2">
                    <input
                      type="number"
                      value={widthPx}
                      onChange={(e) => setWidthPx(Math.max(64, Math.min(2048, Number(e.target.value) || 1080)))}
                      className="w-28 px-2 py-1 border border-slate-300 rounded"
                    />
                    <span className="text-sm text-slate-600">×</span>
                    <input
                      type="number"
                      value={heightPx}
                      onChange={(e) => setHeightPx(Math.max(64, Math.min(2048, Number(e.target.value) || 1080)))}
                      className="w-28 px-2 py-1 border border-slate-300 rounded"
                    />
                    <span className="ml-2 text-xs text-slate-500">(clamp 64–2048)</span>
                  </div>
                </div>
              </div>

              {/* Seed */}
              <div className="mb-6">
                <label className="block text-sm font-semibold text-slate-700 mb-2">
                  Seed
                </label>
                <div className="flex items-center gap-2">
                  <input
                    type="number"
                    value={seed}
                    onChange={(e) => {
                      const v = e.target.value;
                      if (v === '') {
                        setSeed('');
                        return;
                      }
                      const n = Number(v);
                      setSeed(Number.isFinite(n) ? Math.trunc(n) : '');
                    }}
                    placeholder="(vide = aléatoire)"
                    className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                  <button
                    type="button"
                    onClick={() => setSeed(Math.floor(Math.random() * 1_000_000_000))}
                    className="shrink-0 bg-slate-100 hover:bg-slate-200 text-slate-700 text-sm font-semibold px-3 py-2 rounded"
                    title="Générer un seed aléatoire"
                  >
                    🎲
                  </button>
                </div>
                <p className="text-xs text-slate-500 mt-1">
                  Pour reproductibilité
                </p>
              </div>

              {/* Steps */}
              <div className="mb-6">
                <label className="block text-sm font-semibold text-slate-700 mb-2">
                  Steps: {steps}
                </label>
                <input
                  type="range"
                  min="10"
                  max="50"
                  value={steps}
                  onChange={(e) => setSteps(parseInt(e.target.value))}
                  className="w-full h-2 bg-slate-200 rounded-lg appearance-none cursor-pointer"
                />
                <p className="text-xs text-slate-500 mt-1">
                  Plus de steps = meilleure qualité
                </p>
              </div>

              {/* Preset Material */}
              <div className="mb-6">
                <label className="block text-sm font-semibold text-slate-700 mb-2">
                  Preset Matériau
                </label>
                <select
                  value={preset}
                  onChange={(e) => setPreset(e.target.value)}
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                >
                  <option value="metal_and_fabric">Métal + Tissu</option>
                  <option value="plastic_and_metal">Plastique + Métal</option>
                  <option value="wood_and_metal">Bois + Métal</option>
                  <option value="all_plastic">Tout plastique</option>
                </select>
              </div>

              {/* CAD Size (cm) */}
              <div className="mb-6">
                <label className="block text-sm font-semibold text-slate-700 mb-2">
                  Taille CAD (cm): {sizeCm}
                </label>
                <input
                  type="range"
                  min={2}
                  max={20}
                  step={1}
                  value={sizeCm}
                  onChange={(e) => setSizeCm(parseInt(e.target.value))}
                  className="w-full h-2 bg-slate-200 rounded-lg appearance-none cursor-pointer"
                />
                <p className="text-xs text-slate-500 mt-1">
                  Définit la taille du cube CAD de démonstration (STEP/STL)
                </p>
              </div>

              {/* Dimensions (mm) */}
              <div className="mb-6">
                <label className="block text-sm font-semibold text-slate-700 mb-2">Dimensions (mm)</label>
                <div className="grid grid-cols-3 gap-3">
                  <div>
                    <span className="block text-xs text-slate-600">Largeur (mm)</span>
                    <input
                      type="number"
                      min={1}
                      value={widthMm}
                      onChange={(e) => setWidthMm(e.target.value === '' ? '' : Math.max(1, Math.round(parseFloat(e.target.value))))}
                      placeholder="ex: 60"
                      className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                    />
                  </div>
                  <div>
                    <span className="block text-xs text-slate-600">Hauteur (mm)</span>
                    <input
                      type="number"
                      min={1}
                      value={heightMm}
                      onChange={(e) => setHeightMm(e.target.value === '' ? '' : Math.max(1, Math.round(parseFloat(e.target.value))))}
                      placeholder="ex: 40"
                      className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                    />
                  </div>
                  <div>
                    <span className="block text-xs text-slate-600">Profondeur (mm)</span>
                    <input
                      type="number"
                      min={1}
                      value={depthMm}
                      onChange={(e) => setDepthMm(e.target.value === '' ? '' : Math.max(1, Math.round(parseFloat(e.target.value))))}
                      placeholder="ex: 10"
                      className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                    />
                  </div>
                </div>
                <p className="text-xs text-slate-500 mt-1">Pré-rempli par la normalisation si disponible.</p>
              </div>

              {/* Generate Button */}
              <button
                onClick={handleGenerate}
                disabled={isGenerating}
                className="w-full inline-flex items-center justify-center bg-blue-600 hover:bg-blue-700 disabled:bg-gray-400 text-white font-semibold px-4 py-2 rounded-lg transition"
                data-testid="generate-run-btn"
              >
                {isGenerating ? '⏳ Génération...' : '🚀 Générer'}
              </button>
              <div className="mt-3 grid grid-cols-2 gap-2">
                <button
                  onClick={handlePreview}
                  type="button"
                  className="w-full inline-flex items-center justify-center bg-indigo-600 hover:bg-indigo-700 text-white font-semibold px-3 py-2 rounded-lg"
                >
                  Aperçu image (1080)
                </button>
                <button
                  onClick={() => { setPreviewUrl(null); setLogs((p) => [...p, 'Preview cleared']); }}
                  type="button"
                  className="w-full inline-flex items-center justify-center bg-slate-100 hover:bg-slate-200 text-slate-700 font-semibold px-3 py-2 rounded-lg"
                >
                  Effacer aperçu
                </button>
              </div>
            </div>
          </div>

          {/* Right: Monitoring */}
          <div className="lg:col-span-2">
            {/* Progress Bar */}
            <div className="bg-white rounded-lg shadow-md p-6 border border-slate-200 mb-6">
              <h2 className="text-xl font-bold text-slate-900 mb-4">Progression</h2>

              <div className="w-full bg-slate-200 rounded-full h-3 overflow-hidden">
                <div
                  className="bg-gradient-to-r from-blue-500 to-green-500 h-full transition-all duration-300"
                  style={{ width: `${progress}%` }}
                    data-testid="progress-bar"
                ></div>
              </div>
              {/* Preview area */}
              {previewUrl && (
                <div className="bg-white rounded-lg shadow-md p-6 border border-slate-200 mb-6">
                  <h3 className="text-lg font-semibold mb-3">Aperçu</h3>
                  <img src={previewUrl} alt="Preview" className="w-full h-auto rounded" />
                  {previewPersisted !== null && (
                    <div className="mt-3 text-sm">
                      {previewPersisted ? (
                        <div className="inline-flex items-center gap-2 text-green-700 bg-green-50 border border-green-200 rounded px-2 py-1">
                          <span>✅ Aperçu enregistré</span>
                          {previewPersistedUrl && (
                            <a href={previewPersistedUrl} target="_blank" rel="noreferrer" className="underline">Ouvrir</a>
                          )}
                        </div>
                      ) : (
                        <div className="inline-flex items-center gap-2 text-yellow-800 bg-yellow-50 border border-yellow-200 rounded px-2 py-1">
                          <span>⚠️ Aperçu non enregistré (stockage indisponible)</span>
                        </div>
                      )}
                    </div>
                  )}
                </div>
              )}

              <p className="text-center text-sm font-semibold text-slate-700 mt-2">
                {progress.toFixed(0)}%
              </p>

              {isGenerating && (
                <p className="text-center text-xs text-slate-500 mt-2">
                  ETA: ~3 min
                </p>
              )}
            </div>
                              <div className="mb-6">
                                <label className="block text-sm font-semibold text-slate-700 mb-2">
                                  Matériaux (liste séparée par virgule ou ligne)
                                </label>
                                <textarea
                                  value={materialsText}
                                  onChange={(e) => setMaterialsText(e.target.value)}
                                  rows={2}
                                  placeholder="ex: Aluminium, Plastique ABS, Verre"
                                  className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                                />
                              </div>

                              {/* Constraints preview (read-only) */}
                              {constraintsJson && (
                                <div className="mb-6">
                                  <label className="block text-sm font-semibold text-slate-700 mb-2">
                                    Contraintes (issues du LLM)
                                  </label>
                                  <pre className="text-xs bg-slate-50 border border-slate-200 rounded p-3 overflow-x-auto">
                {JSON.stringify(constraintsJson, null, 2)}
                                  </pre>
                                </div>
                              )}

            {/* Logs */}
            <div className="bg-slate-900 text-slate-100 rounded-lg shadow-md p-6 border border-slate-700 font-mono text-sm h-64 overflow-y-auto">
              <h2 className="text-lg font-bold text-slate-100 mb-4">Logs</h2>
              <div className="space-y-1">
                {logs.map((log, idx) => (
                  <div key={idx} className="text-slate-300">
                    {log}
                              {appliedNotice && (
                                <div className="mt-3 text-xs text-green-700 bg-green-50 border border-green-200 rounded px-2 py-1">
                                  {appliedNotice}
                                </div>
                              )}
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      </main>
    </div>
  );
}
