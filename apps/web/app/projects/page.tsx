'use client';

import Link from 'next/link';
import { useEffect, useState } from 'react';

import { IconFolder, IconPlus, IconPlay } from '~/components/icons';
import { apiGetProjects, apiGetRuns, apiGetVariants } from '~/lib/api/fastapi';
import { MOCK_PROJECTS, MOCK_RUNS } from '~/lib/mock-data';
import type { Project } from '~/lib/types';

type ProjectKpi = {
  runsCount: number;
  latestStatus?: string;
  bestScore?: number;
};

type ApiRun = {
  id?: string;
  run_id?: string;
  project_id?: string;
  created_at?: string;
  status?: string;
  score?: number | string;
  metadata?: {
    score?: number | string;
    best_score?: number | string;
  };
};

type ApiVariant = {
  score?: number | string;
};

function toNumber(value: unknown): number | undefined {
  const numberValue = typeof value === 'number' ? value : Number(value);
  return Number.isFinite(numberValue) ? numberValue : undefined;
}

function statusUi(status?: string) {
  const value = (status || '').toLowerCase();

  if (value === 'completed' || value === 'success' || value === 'succeeded') {
    return { label: 'Ready', className: 'bg-emerald-50 text-emerald-700 ring-emerald-200' };
  }

  if (value === 'failed' || value === 'error') {
    return { label: 'Review', className: 'bg-rose-50 text-rose-700 ring-rose-200' };
  }

  if (value === 'processing' || value === 'running') {
    return { label: 'Running', className: 'bg-sky-50 text-sky-700 ring-sky-200' };
  }

  return { label: 'Draft', className: 'bg-slate-100 text-slate-700 ring-slate-200' };
}

function typeLabel(type?: string) {
  const labels: Record<string, string> = {
    furniture: 'Furniture',
    electronics: 'Electronics',
    mechanical: 'Mechanical',
    other: 'Other',
  };

  return labels[type || 'other'] || type || 'Other';
}

export default function ProjectsPage() {
  const [projects, setProjects] = useState<Project[]>(MOCK_PROJECTS);
  const [loading, setLoading] = useState(true);
  const [kpisByProjectId, setKpisByProjectId] = useState<Record<string, ProjectKpi>>({});

  useEffect(() => {
    let mounted = true;

    async function load() {
      try {
        setLoading(true);
        const [projectItems, runItems] = await Promise.all([
          apiGetProjects().catch(() => null),
          apiGetRuns().catch(() => null),
        ]);

        const safeProjects =
          Array.isArray(projectItems) && projectItems.length > 0
            ? (projectItems as Project[])
            : MOCK_PROJECTS;
        const safeRuns = Array.isArray(runItems) && runItems.length > 0 ? runItems : MOCK_RUNS;
        const nextKpis: Record<string, ProjectKpi> = {};
        const latestRunByProjectId: Record<string, { runId: string; createdAt: string; status?: string; fallbackScore?: number }> = {};

        for (const run of safeRuns) {
          const typedRun = run as ApiRun;
          const projectId = String(typedRun.project_id || '');
          if (!projectId) continue;

          const runId = String(typedRun.run_id || typedRun.id || '');
          const createdAt = String(typedRun.created_at || '');
          const metadata = typedRun.metadata || {};
          const fallbackScore =
            toNumber(typedRun.score) ?? toNumber(metadata.score) ?? toNumber(metadata.best_score);

          nextKpis[projectId] = nextKpis[projectId] ?? { runsCount: 0 };
          nextKpis[projectId].runsCount += 1;

          const previous = latestRunByProjectId[projectId];
          if (!previous || createdAt >= previous.createdAt) {
            latestRunByProjectId[projectId] = {
              runId,
              createdAt,
              status: String(typedRun.status || ''),
              fallbackScore,
            };
          }
        }

        await Promise.all(
          Object.entries(latestRunByProjectId).map(async ([projectId, latestRun]) => {
            const kpi = nextKpis[projectId];
            if (!kpi) return;

            kpi.latestStatus = latestRun.status;
            kpi.bestScore = latestRun.fallbackScore;

            if (!latestRun.runId) return;

            try {
              const variants = await apiGetVariants(latestRun.runId);
              const scores = (variants || [])
                .map((variant: ApiVariant) => toNumber(variant.score))
                .filter((score): score is number => typeof score === 'number');

              if (scores.length > 0) {
                kpi.bestScore = Math.max(...scores);
                if (!kpi.latestStatus || ['queued', 'pending'].includes(kpi.latestStatus)) {
                  kpi.latestStatus = 'completed';
                }
              }
            } catch {
              // Run-level KPIs are enough when variants are unavailable.
            }
          }),
        );

        if (!mounted) return;
        setProjects(safeProjects);
        setKpisByProjectId(nextKpis);
      } finally {
        if (mounted) setLoading(false);
      }
    }

    load();

    return () => {
      mounted = false;
    };
  }, []);

  return (
    <div className="space-y-6">
      <section className="flex flex-col gap-4 rounded-lg border border-slate-200 bg-white p-6 md:flex-row md:items-center md:justify-between">
        <div>
          <div className="mb-2 inline-flex items-center gap-2 rounded-full bg-slate-100 px-3 py-1 text-xs font-medium text-slate-700 ring-1 ring-slate-200">
            <IconFolder /> Project library
          </div>
          <h1 className="text-3xl font-semibold tracking-tight text-slate-950">Projects</h1>
          <p className="mt-2 max-w-2xl text-sm leading-6 text-slate-600">
            Keep briefs, generated runs, DfX reviews, and export artifacts organized by product concept.
          </p>
        </div>
        <Link
          href="/projects/create"
          className="inline-flex items-center justify-center gap-2 rounded-md bg-slate-950 px-4 py-2 text-sm font-semibold text-white transition hover:bg-slate-800"
          data-testid="new-project-btn"
        >
          <IconPlus /> New project
        </Link>
      </section>

      {loading && <div className="text-sm text-slate-500">Syncing projects...</div>}

      {projects.length === 0 ? (
        <div className="rounded-lg border border-dashed border-slate-300 bg-white p-10 text-center">
          <p className="text-lg font-semibold text-slate-950">No projects yet</p>
          <p className="mt-2 text-sm text-slate-500">Create one to start generating concepts.</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 gap-4 lg:grid-cols-2" data-testid="projects-grid">
          {projects.map((project) => {
            const kpis = kpisByProjectId[project.id];
            const status = statusUi(kpis?.latestStatus);
            const scoreText = typeof kpis?.bestScore === 'number' ? kpis.bestScore.toFixed(1) : '-';

            return (
              <article
                key={project.id}
                className="rounded-lg border border-slate-200 bg-white p-5 transition hover:border-slate-300 hover:shadow-sm"
              >
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <h2 className="text-xl font-semibold text-slate-950">{project.title}</h2>
                    <p className="mt-1 text-sm text-slate-500">{typeLabel(project.product_type)}</p>
                  </div>
                  <span className={`rounded-full px-2.5 py-1 text-xs font-medium ring-1 ${status.className}`}>
                    {status.label}
                  </span>
                </div>

                <p className="mt-4 line-clamp-2 text-sm leading-6 text-slate-600">
                  {project.description || project.brief || 'No brief has been added yet.'}
                </p>

                <div className="mt-5 grid grid-cols-3 gap-3 rounded-md bg-slate-50 p-3">
                  <Kpi label="Runs" value={kpis?.runsCount ?? 0} />
                  <Kpi label="Best score" value={scoreText} />
                  <Kpi label="Created" value={new Date(project.created_at).toLocaleDateString()} />
                </div>

                <div className="mt-5 flex gap-2">
                  <Link
                    href={`/projects/${project.id}`}
                    className="flex-1 rounded-md border border-slate-300 px-3 py-2 text-center text-sm font-semibold text-slate-800 transition hover:bg-slate-50"
                    data-testid="project-details-btn"
                  >
                    Details
                  </Link>
                  <Link
                    href={`/projects/${project.id}/generate`}
                    className="inline-flex flex-1 items-center justify-center gap-2 rounded-md bg-blue-600 px-3 py-2 text-sm font-semibold text-white transition hover:bg-blue-700"
                    data-testid="project-generate-btn"
                  >
                    <IconPlay /> Generate
                  </Link>
                </div>
              </article>
            );
          })}
        </div>
      )}
    </div>
  );
}

function Kpi({ label, value }: { label: string; value: string | number }) {
  return (
    <div>
      <p className="text-xs text-slate-500">{label}</p>
      <p className="mt-1 truncate font-semibold text-slate-950">{value}</p>
    </div>
  );
}
