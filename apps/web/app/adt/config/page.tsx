'use client';

import { useEffect, useMemo, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';

import AdtHeader from '~/adt/_components/AdtHeader';
import { apiGetProject, apiGetRun, apiLaunchRun, apiPatchRun } from '~/lib/api/fastapi';

function num(v: string) {
  if (!v) return undefined;
  const n = Number(v);
  return Number.isFinite(n) ? n : undefined;
}

const DFX_KEYS = ['dfm', 'dfa', 'dfr', 'dfc', 'dfs'] as const;
const DFX_META: Record<string, { label: string; desc: string; color: string }> = {
  dfm: { label: 'DfM', desc: 'Design for Manufacturing', color: '#6366f1' },
  dfa: { label: 'DfA', desc: 'Design for Assembly',      color: '#06b6d4' },
  dfr: { label: 'DfR', desc: 'Design for Reliability',   color: '#10b981' },
  dfc: { label: 'DfC', desc: 'Design for Cost',          color: '#f59e0b' },
  dfs: { label: 'DfS', desc: 'Design for Sustainability', color: '#f43f5e' },
};

type DfxState = Record<typeof DFX_KEYS[number], string>;

function SectionTitle({ title, sub, color = '#6366f1' }: { title: string; sub?: string; color?: string }) {
  return (
    <div className="mb-4">
      <div className="flex items-center gap-2">
        <span style={{ display: 'inline-block', width: 8, height: 8, borderRadius: '50%', background: color, boxShadow: `0 0 6px ${color}` }} />
        <div className="text-sm font-bold text-white">{title}</div>
        {sub && <div className="adt-metric-label ml-2">{sub}</div>}
      </div>
      <div className="adt-accent-line mt-2" style={{ width: 48 }} />
    </div>
  );
}

function FieldRow({ label, unit, value, onChange, readOnly }: {
  label: string; unit?: string; value: string;
  onChange?: (v: string) => void; readOnly?: boolean;
}) {
  return (
    <div className="flex flex-col gap-1.5">
      <label className="adt-metric-label">{label}{unit ? <span className="ml-1 normal-case">({unit})</span> : ''}</label>
      <input
        className="adt-input"
        value={value}
        readOnly={readOnly}
        onChange={onChange ? (e) => onChange(e.target.value) : undefined}
        style={readOnly ? { opacity: 0.6, cursor: 'default' } : {}}
      />
    </div>
  );
}

function DfxSlider({ k, value, onChange }: { k: string; value: string; onChange: (v: string) => void }) {
  const meta  = DFX_META[k]!;
  const pct   = Math.min(Math.max(Number(value) * 100, 0), 100);
  const numVal = Number(value) || 0;

  function handleSlider(e: React.ChangeEvent<HTMLInputElement>) {
    onChange((Number(e.target.value) / 100).toFixed(2));
  }
  function handleInput(e: React.ChangeEvent<HTMLInputElement>) {
    onChange(e.target.value);
  }

  return (
    <div className="adt-glass p-4" style={{ borderRadius: 12 }}>
      <div className="flex items-center justify-between mb-2">
        <div>
          <span className="font-bold text-sm" style={{ color: meta.color }}>{meta.label}</span>
          <span className="text-xs ml-2" style={{ color: '#64748b' }}>{meta.desc}</span>
        </div>
        <input
          type="number"
          step="0.01"
          min="0"
          max="1"
          className="adt-input text-right font-mono text-xs"
          style={{ width: 70 }}
          value={value}
          onChange={handleInput}
        />
      </div>
      <input
        type="range"
        min={0}
        max={100}
        value={pct}
        onChange={handleSlider}
        className="w-full"
        style={{ accentColor: meta.color, cursor: 'pointer', height: 6, borderRadius: 3 }}
      />
      <div className="adt-dfx-track mt-2">
        <div
          className="adt-dfx-fill"
          style={{ width: `${pct}%`, background: `linear-gradient(90deg, ${meta.color}99, ${meta.color})` }}
        />
      </div>
      <div className="flex justify-between adt-metric-label mt-1" style={{ fontSize: 9 }}>
        <span>0%</span>
        <span style={{ color: meta.color }}>{pct.toFixed(0)}%</span>
        <span>100%</span>
      </div>
    </div>
  );
}

function DfxSumBadge({ weights }: { weights: DfxState }) {
  const total = DFX_KEYS.reduce((acc, k) => acc + (Number(weights[k]) || 0), 0);
  const ok    = Math.abs(total - 1) < 0.02;
  return (
    <div
      className="adt-status-pill"
      style={{
        fontSize: 11,
        background: ok ? 'rgba(16,185,129,0.12)' : 'rgba(245,158,11,0.12)',
        color:      ok ? '#10b981'               : '#f59e0b',
        border:     `1px solid ${ok ? 'rgba(16,185,129,0.35)' : 'rgba(245,158,11,0.35)'}`,
      }}
    >
      {ok ? 'SUM DFX OK' : 'SUM DFX'} = {(total * 100).toFixed(0)}%{!ok && ' (target 100%)'}
    </div>
  );
}

export default function AdtConfigPage() {
  const sp        = useSearchParams();
  const router    = useRouter();
  const projectId = sp?.get('projectId') || '';
  const runId     = sp?.get('runId')     || '';

  const [loading,   setLoading]   = useState(true);
  const [saving,    setSaving]    = useState(false);
  const [launching, setLaunching] = useState(false);
  const [error,     setError]     = useState<string | null>(null);
  const [saved,     setSaved]     = useState(false);

  /* Project meta */
  const [projectTitle, setProjectTitle] = useState('');
  const [brief,        setBrief]        = useState('');

  /* Constraints */
  const [maxPressureBar,  setMaxPressureBar]  = useState('');
  const [proofPressureBar,setProofPressureBar]= useState('');
  const [maxTempC,        setMaxTempC]        = useState('');
  const [massTargetG,     setMassTargetG]     = useState('');
  const [costTargetEur,   setCostTargetEur]   = useState('');
  const [minWallMm,       setMinWallMm]       = useState('');
  const [surfaceRaUm,     setSurfaceRaUm]     = useState('');
  const [standards,       setStandards]       = useState('');

  /* Simulation targets */
  const [maxDeflectionMm,  setMaxDeflectionMm]  = useState('');
  const [minSafetyFactor,  setMinSafetyFactor]  = useState('');

  /* DfX weights */
  const [dfx, setDfx] = useState<DfxState>({
    dfm: '0.28', dfa: '0.18', dfr: '0.24', dfc: '0.10', dfs: '0.20',
  });

  const dfxWeights = useMemo(() =>
    Object.fromEntries(DFX_KEYS.map((k) => [k, num(dfx[k]) ?? 0])),
  [dfx]);

  /* Load */
  useEffect(() => {
    if (!projectId || !runId) { setLoading(false); return; }
    let cancelled = false;
    (async () => {
      try {
        const [p, r] = await Promise.all([apiGetProject(projectId), apiGetRun(runId)]);
        if (cancelled) return;
        setProjectTitle((p as any)?.title || '');
        setBrief((p as any)?.brief || (p as any)?.description || '');

        const c = (r as any)?.constraints || {};
        setMaxPressureBar(String(c.max_pressure_bar ?? ''));
        setProofPressureBar(String(c.proof_pressure_bar ?? ''));
        setMaxTempC(String(c.max_temp_c ?? ''));
        setMassTargetG(String(c.mass_target_g ?? ''));
        setCostTargetEur(String(c.cost_target_eur ?? ''));
        setMinWallMm(String(c.min_wall_mm ?? ''));
        setSurfaceRaUm(String(c.surface_ra_um ?? ''));
        const std = c.applicable_standards;
        setStandards(Array.isArray(std) ? std.join(', ') : String(std ?? ''));

        const opts    = (r as any)?.options || {};
        const targets = opts.simulation_targets || {};
        setMaxDeflectionMm(String(targets.max_deflection_mm ?? ''));
        setMinSafetyFactor(String(targets.min_safety_factor ?? ''));

        const w = opts.dfx_weights || {};
        setDfx((prev) => ({
          dfm: w.dfm != null ? String(w.dfm) : prev.dfm,
          dfa: w.dfa != null ? String(w.dfa) : prev.dfa,
          dfr: w.dfr != null ? String(w.dfr) : prev.dfr,
          dfc: w.dfc != null ? String(w.dfc) : prev.dfc,
          dfs: w.dfs != null ? String(w.dfs) : prev.dfs,
        }));
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => { cancelled = true; };
  }, [projectId, runId]);

  async function save() {
    if (!runId) return;
    setSaving(true); setError(null);
    try {
      await apiPatchRun(runId, {
        constraints: {
          max_pressure_bar: num(maxPressureBar),
          proof_pressure_bar: num(proofPressureBar),
          max_temp_c: num(maxTempC),
          mass_target_g: num(massTargetG),
          cost_target_eur: num(costTargetEur),
          min_wall_mm: num(minWallMm),
          surface_ra_um: num(surfaceRaUm),
          applicable_standards: standards.split(',').map((s) => s.trim()).filter(Boolean),
        },
        options: {
          dfx_weights: dfxWeights,
          simulation_targets: {
            max_deflection_mm: num(maxDeflectionMm),
            min_safety_factor: num(minSafetyFactor),
          },
        },
      });
      setSaved(true);
      setTimeout(() => setSaved(false), 2500);
    } catch (e: any) {
      setError(String(e?.message || e));
    } finally {
      setSaving(false);
    }
  }

  async function launch() {
    if (!runId) return;
    setLaunching(true); setError(null);
    try {
      await save();
      const res = await apiLaunchRun(runId);
      router.push(
        `/adt/agents?projectId=${encodeURIComponent(projectId)}&runId=${encodeURIComponent(runId)}&jobId=${encodeURIComponent(res.job_id)}`
      );
    } catch (e: any) {
      setError(String(e?.message || e));
    } finally {
      setLaunching(false);
    }
  }

  if (!projectId || !runId) {
    return (
      <div className="adt-root space-y-6">
        <AdtHeader />
        <div className="adt-glass p-8 text-center" style={{ borderColor: 'rgba(244,63,94,0.3)' }}>
          <div className="adt-metric-label mb-3" style={{ color: '#f43f5e', fontSize: 12 }}>MISSING RUN</div>
          <div className="font-bold text-white mb-2">Run manquant</div>
          <div className="text-sm" style={{ color: '#64748b' }}>
            Revenez à <strong style={{ color: '#818cf8' }}>E1 Scenario</strong> pour créer un projet + run.
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="adt-root space-y-6">
      <AdtHeader />

      {/* Header card */}
      <div className="adt-glass p-5" style={{ borderColor: 'rgba(6,182,212,0.2)' }}>
        <div className="flex flex-col md:flex-row md:items-center gap-4">
          <div className="flex-1">
            <div className="adt-metric-label mb-1">Étape 2 / 7</div>
            <h2 className="text-lg font-bold text-white mb-1">Configuration du projet</h2>
            <div className="text-sm" style={{ color: '#64748b' }}>
              Exigences produit · Contraintes physiques · Pondérations DfX · Cibles simulation
            </div>
          </div>
          {loading && <div className="adt-spinner" style={{ width: 20, height: 20 }} />}
          <div className="flex items-center gap-2">
            <DfxSumBadge weights={dfx} />
            {saved && <span className="adt-status-pill pass">SAVED</span>}
          </div>
        </div>
      </div>

      {error && (
        <div className="adt-glass p-4" style={{ borderColor: 'rgba(244,63,94,0.4)', background: 'rgba(244,63,94,0.08)' }}>
          <div className="adt-fail text-sm flex items-center gap-2"><span className="adt-error-icon" />{error}</div>
        </div>
      )}

      {/* Project meta */}
      <div className="adt-glass p-5">
        <SectionTitle title="Informations projet" color="#818cf8" />
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
          <FieldRow label="Titre projet" value={projectTitle} readOnly />
          <FieldRow label="Brief" value={brief} readOnly />
        </div>
      </div>

      {/* Physical constraints */}
      <div className="adt-glass p-5">
        <SectionTitle title="Contraintes physiques" sub="product configuration" color="#06b6d4" />
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
          <FieldRow label="Pression max" unit="bar"   value={maxPressureBar}   onChange={setMaxPressureBar} />
          <FieldRow label="Pression épreuve" unit="bar" value={proofPressureBar} onChange={setProofPressureBar} />
          <FieldRow label="Température max" unit="°C" value={maxTempC}         onChange={setMaxTempC} />
          <FieldRow label="Masse cible" unit="g"      value={massTargetG}      onChange={setMassTargetG} />
          <FieldRow label="Coût cible" unit="€"       value={costTargetEur}    onChange={setCostTargetEur} />
          <FieldRow label="Épaisseur min" unit="mm"   value={minWallMm}        onChange={setMinWallMm} />
          <FieldRow label="Rugosité Ra" unit="µm"     value={surfaceRaUm}      onChange={setSurfaceRaUm} />
          <div className="sm:col-span-2">
            <FieldRow label="Normes applicables (séparées par virgules)" value={standards} onChange={setStandards} />
          </div>
        </div>
      </div>

      {/* Simulation targets */}
      <div className="adt-glass p-5">
        <SectionTitle title="Cibles de simulation" sub="FEM / structural" color="#10b981" />
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <FieldRow label="Déflexion max" unit="mm"   value={maxDeflectionMm}  onChange={setMaxDeflectionMm} />
          <FieldRow label="Facteur de sécurité min"   value={minSafetyFactor}  onChange={setMinSafetyFactor} />
        </div>
      </div>

      {/* DfX weights */}
      <div className="adt-glass p-5">
        <SectionTitle title="Pondérations DfX" sub="priority weights 0–1" color="#f59e0b" />
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5">
          {DFX_KEYS.map((k) => (
            <DfxSlider
              key={k}
              k={k}
              value={dfx[k]}
              onChange={(v) => setDfx((prev) => ({ ...prev, [k]: v }))}
            />
          ))}
        </div>
      </div>

      {/* Footer actions */}
      <div className="adt-glass p-4 flex flex-wrap items-center justify-between gap-3">
        <div className="text-xs" style={{ color: '#64748b' }}>
          {loading ? 'Chargement des données\u2026' : "Configuration prête \u00b7 Lancez les agents pour d\u00e9marrer l\u2019analyse."}
        </div>
        <div className="flex gap-3">
          <button
            className="adt-btn-secondary"
            disabled={saving || launching || loading}
            onClick={save}
          >
            {saving ? <><span className="adt-spinner" /> Enregistrement…</> : 'Enregistrer'}
          </button>
          <button
            className="adt-btn-primary"
            disabled={saving || launching || loading}
            onClick={launch}
          >
            {launching ? <><span className="adt-spinner" /> Lancement…</> : 'Launch Agents →'}
          </button>
        </div>
      </div>
    </div>
  );
}
