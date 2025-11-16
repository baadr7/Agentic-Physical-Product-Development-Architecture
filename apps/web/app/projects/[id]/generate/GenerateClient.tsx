'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import { apiNormalizeBrief } from '~/lib/api/fastapi';
import { useRouter } from 'next/navigation';

export default function GenerateClient({ projectId }: { projectId: string }) {
  const router = useRouter();
  const [guidance_scale, setGuidanceScale] = useState(7.5);
  const [seed, setSeed] = useState(42);
  const [steps, setSteps] = useState(20);
  const [preset, setPreset] = useState('metal_and_fabric');
  const [sizeCm, setSizeCm] = useState<number>(5);
  const [brief, setBrief] = useState('');
  const [normalized, setNormalized] = useState<any | null>(null);
  const [normalizing, setNormalizing] = useState(false);
  const [normalizeError, setNormalizeError] = useState<string | null>(null);
  const [appliedNotice, setAppliedNotice] = useState<string | null>(null);
  const [isGenerating, setIsGenerating] = useState(false);
  const [progress, setProgress] = useState(0);
  const [logs, setLogs] = useState<string[]>(['Prêt à générer...']);
  const [materialsText, setMaterialsText] = useState('');
  const [constraintsJson, setConstraintsJson] = useState<Record<string, unknown> | null>(null);
  const pollRef = useRef<number | null>(null);
  const API_BASE = useMemo(
    () => process.env.NEXT_PUBLIC_API_BASE_URL || 'http://localhost:8000',
    []
  );

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
        options: { guidance_scale, seed, steps, preset, size_cm: sizeCm },
      };

      const res = await fetch(`${API_BASE}/api/v1/runs`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });

      if (!res.ok) throw new Error(`API error ${res.status}`);

      const data = await res.json();
      const runId: string = data.run_id;
      setLogs((prev) => [...prev, `Run créé: ${runId}`, '⏳ En attente de traitement...']);
      setProgress(10);

      // Poll run status
      let lastStatus: string | null = null;
      pollRef.current = window.setInterval(async () => {
        try {
          const r = await fetch(`${API_BASE}/api/v1/runs/${runId}`);
          if (!r.ok) throw new Error('poll failed');
          const run = await r.json();
          const status = (run?.status as string) || 'queued';
          if (status !== lastStatus) {
            setLogs((prev) => [...prev, `Statut: ${status}`]);
            lastStatus = status;
          }
          if (status === 'queued') setProgress((p) => Math.max(p, 15));
          else if (status === 'processing') setProgress((p) => Math.max(p, 60));
          else if (status === 'completed') {
            setProgress(100);
            const summary = run?.metadata?.dfx_summary as string | undefined;
            if (summary) setLogs((prev) => [...prev, `DfX: ${summary}`]);
            setLogs((prev) => [...prev, '✅ Génération terminée !']);
            if (pollRef.current) {
              window.clearInterval(pollRef.current);
              pollRef.current = null;
            }
            setIsGenerating(false);
            // Navigate to results page for the project
            router.push(`/projects/${projectId}/results`);
          }
        } catch (err) {
          // Keep polling; temporary failure
        }
      }, 1000);
    } catch (err) {
      // Fallback: simulate locally
      setLogs((prev) => [
        ...prev,
        'API indisponible — simulation locale...',
      ]);
      const logMessages = [
        '📝 Extraction du brief...',
        '🤖 Génération prompts...',
        '🎨 Génération image...',
        '📦 Modèle 3D...',
        '⚖️ Scores DfX...',
        '✅ Génération terminée !',
      ];
      for (let i = 0; i < logMessages.length; i++) {
        // eslint-disable-next-line no-await-in-loop
        await new Promise((resolve) => setTimeout(resolve, 500));
        setLogs((prev) => [...prev, logMessages[i] as string]);
        setProgress(((i + 1) / logMessages.length) * 100);
      }
      setIsGenerating(false);
    }
  };

  const handleNormalizeBrief = async () => {
    setNormalizeError(null);
    setNormalizing(true);
    try {
      const res = await apiNormalizeBrief(brief || '');
      if (!res.ok) {
        setNormalizeError('LLM non configuré (Mistral). Définissez MISTRAL_API_KEY côté API.');
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
              </div>

              {/* Seed */}
              <div className="mb-6">
                <label className="block text-sm font-semibold text-slate-700 mb-2">
                  Seed
                </label>
                <input
                  type="number"
                  value={seed}
                  onChange={(e) => setSeed(parseInt(e.target.value))}
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
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

              {/* Generate Button */}
              <button
                onClick={handleGenerate}
                disabled={isGenerating}
                  className="w-full bg-green-600 hover:bg-green-700 disabled:bg-gray-400 text-white font-bold py-3 rounded-lg transition"
                  data-testid="generate-run-btn"
              >
                {isGenerating ? '⏳ Génération...' : '🚀 Générer'}
              </button>
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
