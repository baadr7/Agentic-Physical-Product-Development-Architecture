'use client';

import Link from 'next/link';
import { useEffect, useState } from 'react';
import { MOCK_PROJECTS, MOCK_RUNS } from '~/lib/mock-data';
import type { Project } from '~/lib/types';
import { apiGetProjects, apiGetRuns, apiGetVariants } from '~/lib/api/fastapi';

type ProjectKpi = {
  runsCount: number;
  latestStatus?: string;
  bestScore?: number;
};

async function mapWithConcurrency<T, R>(
  items: T[],
  limit: number,
  fn: (item: T) => Promise<R>,
): Promise<R[]> {
  const results: R[] = new Array(items.length);
  let nextIndex = 0;

  async function worker() {
    while (true) {
      const i = nextIndex;
      nextIndex += 1;
      if (i >= items.length) return;
      results[i] = await fn(items[i]!);
    }
  }

  const workers = Array.from({ length: Math.max(1, limit) }, () => worker());
  await Promise.all(workers);
  return results;
}

function toNumberOrUndefined(value: unknown): number | undefined {
  const num = typeof value === 'number' ? value : Number(value);
  return Number.isFinite(num) ? num : undefined;
}

function statusUi(status?: string): { label: string; className: string } {
  const s = (status || '').toLowerCase();
  if (!s) return { label: '—', className: 'text-slate-500' };
  if (s === 'completed' || s === 'success' || s === 'succeeded') return { label: '✓', className: 'text-green-600' };
  if (s === 'failed' || s === 'error') return { label: '✗', className: 'text-red-600' };
  if (s === 'processing' || s === 'running') return { label: '⏳', className: 'text-amber-600' };
  if (s === 'pending' || s === 'queued') return { label: '…', className: 'text-slate-600' };
  return { label: s, className: 'text-slate-600' };
}

export default function ProjectsPage() {
  const [projects, setProjects] = useState<Project[]>([]);
  const [loading, setLoading] = useState<boolean>(false);
  const [kpisByProjectId, setKpisByProjectId] = useState<Record<string, ProjectKpi>>({});

  useEffect(() => {
    let mounted = true;
    async function load() {
      try {
        setLoading(true);
        const [projectItems, runItems] = await Promise.all([
          apiGetProjects(),
          apiGetRuns().catch((e) => {
            console.warn('Runs fetch failed', e);
            return null;
          }),
        ]);

        const safeProjects = Array.isArray(projectItems) ? (projectItems as Project[]) : [];
        if (mounted) setProjects(safeProjects);

        const runs = Array.isArray(runItems) ? runItems : null;
        const effectiveRuns = runs ?? (safeProjects.length ? [] : MOCK_RUNS);
        const nextKpis: Record<string, ProjectKpi> = {};
        const latestRunByProjectId: Record<string, { runId: string; createdAt: string; status?: string; fallbackScore?: number }> = {};

        for (const r of effectiveRuns) {
          const projectId = String((r as any)?.project_id || (r as any)?.projectId || '');
          if (!projectId) continue;

          const createdAt = String((r as any)?.created_at || (r as any)?.createdAt || '');
          const status = String((r as any)?.status || '');

          const runId = String((r as any)?.run_id || (r as any)?.runId || (r as any)?.id || '');

          const metadata = (r as any)?.metadata;
          const candidateScores: Array<number | undefined> = [
            toNumberOrUndefined((r as any)?.score),
            toNumberOrUndefined(metadata?.score),
            toNumberOrUndefined(metadata?.best_score),
          ];
          const fallbackScore = candidateScores.find((v) => typeof v === 'number');

          const existing = nextKpis[projectId] ?? { runsCount: 0 };
          existing.runsCount += 1;

          nextKpis[projectId] = existing;

          // Track the latest run per project (ISO timestamps sort lexicographically).
          const prev = latestRunByProjectId[projectId];
          if (!prev || (createdAt && createdAt >= prev.createdAt)) {
            latestRunByProjectId[projectId] = {
              runId,
              createdAt,
              status,
              fallbackScore,
            };
          }
        }

        // Fetch variant scores for the latest run of each project.
        const latestEntries = Object.entries(latestRunByProjectId).filter(([, v]) => Boolean(v.runId));
        const variantBestByProject = new Map<string, number>();
        const inferredStatusByProject = new Map<string, string>();
        await mapWithConcurrency(latestEntries, 4, async ([projectId, info]) => {
          try {
            const variants = await apiGetVariants(info.runId);
            const variantsCount = Array.isArray(variants) ? variants.length : 0;
            const scores = (variants || [])
              .map((v: any) => toNumberOrUndefined(v?.score))
              .filter((v: any) => typeof v === 'number') as number[];
            if (scores.length) variantBestByProject.set(projectId, Math.max(...scores));

            // If we already have variants but the run status is still queued/pending,
            // treat the project as completed to avoid stale status UX.
            const s = String(info.status || '').toLowerCase();
            if (variantsCount > 0 && (s === '' || s === 'queued' || s === 'pending')) {
              inferredStatusByProject.set(projectId, 'completed');
            }
          } catch (e) {
            // If variants endpoint is unavailable, fall back to run-level score.
          }
        });

        for (const projectId of Object.keys(nextKpis)) {
          const kpi = nextKpis[projectId];
          if (!kpi) continue;

          const latest = latestRunByProjectId[projectId];
          const inferred = inferredStatusByProject.get(projectId);
          if (inferred) kpi.latestStatus = inferred;
          else if (latest?.status) kpi.latestStatus = latest.status;

          const bestVariantScore = variantBestByProject.get(projectId);
          if (typeof bestVariantScore === 'number') {
            kpi.bestScore = bestVariantScore;
          } else if (typeof latest?.fallbackScore === 'number') {
            kpi.bestScore = latest.fallbackScore;
          }
        }
        if (mounted) setKpisByProjectId(nextKpis);
      } catch (e) {
        // fallback to mock data when API is unavailable
        console.warn('Projects fetch failed, showing mock', e);
        if (mounted) {
          setProjects(MOCK_PROJECTS);
          // Provide non-empty KPIs when running purely in mock mode.
          const mockKpis: Record<string, ProjectKpi> = {};
          for (const r of MOCK_RUNS) {
            const pid = r.project_id;
            mockKpis[pid] = mockKpis[pid] ?? { runsCount: 0 };
            mockKpis[pid].runsCount += 1;
            mockKpis[pid].latestStatus = r.status;
          }
          setKpisByProjectId(mockKpis);
        }
      } finally {
        if (mounted) setLoading(false);
      }
    }
    load();
    return () => {
      mounted = false;
    };
  }, []);

  const getProductTypeLabel = (type: string) => {
    const labels: Record<string, string> = {
      furniture: '🪑 Mobilier',
      electronics: '📱 Électronique',
      mechanical: '⚙️ Mécanique',
      other: '📦 Autre',
    };
    return labels[type] || type;
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 to-slate-100">
      {/* Header */}
      <header className="bg-white shadow-sm border-b border-slate-200">
        <div className="max-w-7xl mx-auto px-6 py-8">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-4xl font-bold text-slate-900">Projets</h1>
              <p className="text-slate-600 mt-1">
                Gérez vos concepts produits avec intelligence IA
              </p>
            </div>
            <Link
              href="/projects/create"
              className="bg-blue-600 hover:bg-blue-700 text-white px-6 py-3 rounded-lg font-semibold transition"
              data-testid="new-project-btn"
            >
              + Nouveau Projet
            </Link>
          </div>
        </div>
      </header>

      {/* Projects Grid */}
      <main className="max-w-7xl mx-auto px-6 py-12">
        {loading && (
          <div className="text-center py-2 text-slate-500">Chargement…</div>
        )}
        {projects.length === 0 ? (
          <div className="text-center py-12">
            <p className="text-slate-500 text-lg">Aucun projet. Créez-en un pour commencer !</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6" data-testid="projects-grid">
            {projects.map((project: Project) => {
              const kpis = kpisByProjectId[project.id];
              const runsCount = kpis?.runsCount ?? 0;
              const status = statusUi(kpis?.latestStatus);
              const scoreText = typeof kpis?.bestScore === 'number' ? kpis.bestScore.toFixed(1) : '—';

              return (
                <div
                  key={project.id}
                  className="bg-white rounded-lg shadow-md hover:shadow-lg transition border border-slate-200 overflow-hidden"
                >
                  <div className="p-6">
                    {/* Title */}
                    <h3 className="text-xl font-bold text-slate-900 mb-2">
                      {project.title}
                    </h3>

                    {/* Type Badge */}
                    <div className="inline-block bg-slate-100 text-slate-700 text-sm px-3 py-1 rounded-full mb-4">
                      {getProductTypeLabel(project.product_type)}
                    </div>

                    {/* Description */}
                    <p className="text-slate-600 text-sm mb-4 line-clamp-2">
                      {project.description}
                    </p>

                    {/* KPIs */}
                    <div className="grid grid-cols-3 gap-2 mb-4 text-center py-2 bg-slate-50 rounded-lg">
                      <div>
                        <p className="text-xs text-slate-500">Runs</p>
                        <p className="font-bold text-slate-900">{runsCount}</p>
                      </div>
                      <div>
                        <p className="text-xs text-slate-500">Score</p>
                        <p className="font-bold text-blue-600">{scoreText}</p>
                      </div>
                      <div>
                        <p className="text-xs text-slate-500">Status</p>
                        <p className={`font-bold ${status.className}`}>{status.label}</p>
                      </div>
                    </div>

                    {/* Date */}
                    <p className="text-xs text-slate-400 mb-4">
                      Créé {new Date(project.created_at).toLocaleDateString('fr-FR')}
                    </p>

                    {/* Actions */}
                    <div className="flex gap-2">
                      <Link
                        href={`/projects/${project.id}`}
                        className="flex-1 bg-blue-50 hover:bg-blue-100 text-blue-600 text-center py-2 rounded-lg font-semibold transition"
                        data-testid="project-details-btn"
                      >
                        Détails
                      </Link>
                      <Link
                        href={`/projects/${project.id}/generate`}
                        className="flex-1 bg-green-50 hover:bg-green-100 text-green-600 text-center py-2 rounded-lg font-semibold transition"
                        data-testid="project-generate-btn"
                      >
                        Générer
                      </Link>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </main>
    </div>
  );
}
