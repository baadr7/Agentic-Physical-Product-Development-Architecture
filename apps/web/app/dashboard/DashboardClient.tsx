'use client';

import Link from 'next/link';
import { useEffect, useMemo, useState } from 'react';
import type { ReactNode } from 'react';

import { IconChart, IconFolder, IconPlay, IconPlus } from '~/components/icons';
import { apiGetProjects, apiGetRuns, apiGetVariants } from '~/lib/api/fastapi';
import { MOCK_PROJECTS, MOCK_RUNS } from '~/lib/mock-data';
import type { Project, Run } from '~/lib/types';

type RunOut = {
  id?: string;
  run_id?: string;
  project_id?: string;
  status?: Run['status'] | string;
  started_at?: string;
  finished_at?: string;
  duration_ms?: number;
  options?: Record<string, unknown>;
  metadata?: Record<string, unknown>;
  created_at?: string;
};

type ProjectHealth = {
  label: string;
  tone: string;
};

function mapRun(run: RunOut): Run {
  const now = new Date().toISOString();
  const runId = run.run_id ?? run.id ?? `run-${Date.now()}`;

  return {
    id: runId,
    run_id: runId,
    project_id: run.project_id ?? '',
    status: (run.status as Run['status']) ?? 'pending',
    started_at: run.started_at ?? run.created_at ?? now,
    finished_at: run.finished_at,
    duration_ms: run.duration_ms,
    parameters: run.options ?? {},
    metadata: run.metadata ?? {},
    created_at: run.created_at ?? now,
  };
}

function formatDate(value?: string) {
  if (!value) return 'No date';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return 'No date';

  return new Intl.DateTimeFormat(undefined, {
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  }).format(date);
}

function projectHealth(status?: string): ProjectHealth {
  const normalized = (status || '').toLowerCase();

  if (normalized === 'completed' || normalized === 'success') {
    return { label: 'Ready', tone: 'bg-emerald-50 text-emerald-700 ring-emerald-200' };
  }

  if (normalized === 'processing' || normalized === 'running') {
    return { label: 'Running', tone: 'bg-sky-50 text-sky-700 ring-sky-200' };
  }

  if (normalized === 'failed' || normalized === 'error') {
    return { label: 'Needs review', tone: 'bg-rose-50 text-rose-700 ring-rose-200' };
  }

  return { label: 'Draft', tone: 'bg-slate-100 text-slate-700 ring-slate-200' };
}

export default function DashboardClient() {
  const [projects, setProjects] = useState<Project[]>(MOCK_PROJECTS);
  const [runs, setRuns] = useState<Run[]>(MOCK_RUNS);
  const [variantCounts, setVariantCounts] = useState<Record<string, number>>({});
  const [loading, setLoading] = useState(true);
  const [apiState, setApiState] = useState<'online' | 'fallback'>('fallback');

  useEffect(() => {
    let mounted = true;

    async function loadDashboard() {
      try {
        setLoading(true);

        const [projectItems, runItems] = await Promise.all([
          apiGetProjects().catch(() => null),
          apiGetRuns().catch(() => null),
        ]);

        const nextProjects =
          Array.isArray(projectItems) && projectItems.length > 0
            ? (projectItems as Project[])
            : MOCK_PROJECTS;
        const nextRuns =
          Array.isArray(runItems) && runItems.length > 0
            ? (runItems as RunOut[]).map(mapRun)
            : MOCK_RUNS;

        if (!mounted) return;

        setProjects(nextProjects);
        setRuns(nextRuns);
        setApiState(Array.isArray(projectItems) || Array.isArray(runItems) ? 'online' : 'fallback');

        const recentRuns = nextRuns.slice(0, 5);
        const counts = await Promise.all(
          recentRuns.map(async (run) => {
            try {
              const variants = await apiGetVariants(run.run_id);
              return [run.run_id, Array.isArray(variants) ? variants.length : 0] as const;
            } catch {
              return [run.run_id, 0] as const;
            }
          }),
        );

        if (mounted) setVariantCounts(Object.fromEntries(counts));
      } finally {
        if (mounted) setLoading(false);
      }
    }

    loadDashboard();

    return () => {
      mounted = false;
    };
  }, []);

  const completedRuns = runs.filter((run) => run.status === 'completed').length;
  const activeRuns = runs.filter((run) => ['pending', 'processing'].includes(run.status)).length;
  const latestRunByProject = useMemo(() => {
    const latest = new Map<string, Run>();

    for (const run of runs) {
      const previous = latest.get(run.project_id);
      if (!previous || run.created_at > previous.created_at) latest.set(run.project_id, run);
    }

    return latest;
  }, [runs]);

  const recentRuns = runs.slice(0, 5);

  return (
    <div className="space-y-6">
      <section className="overflow-hidden rounded-lg border border-slate-200 bg-white">
        <div className="grid gap-0 lg:grid-cols-[1.4fr_0.9fr]">
          <div className="p-6 md:p-8">
            <div className="mb-5 inline-flex items-center gap-2 rounded-full bg-slate-100 px-3 py-1 text-xs font-medium text-slate-700 ring-1 ring-slate-200">
              AI product design workspace
            </div>
            <h1 className="max-w-3xl text-3xl font-semibold tracking-tight text-slate-950 md:text-5xl">
              Generate, compare, and validate product concepts in one calm workspace.
            </h1>
            <p className="mt-4 max-w-2xl text-sm leading-6 text-slate-600 md:text-base">
              Move from brief to variants, DfX review, reports, and exports without losing the project context.
            </p>
            <div className="mt-6 flex flex-wrap gap-3">
              <Link
                href="/projects/create"
                className="inline-flex items-center gap-2 rounded-md bg-slate-950 px-4 py-2 text-sm font-semibold text-white transition hover:bg-slate-800"
              >
                <IconPlus /> New project
              </Link>
              <Link
                href="/projects"
                className="inline-flex items-center gap-2 rounded-md border border-slate-300 bg-white px-4 py-2 text-sm font-semibold text-slate-800 transition hover:bg-slate-50"
              >
                <IconFolder /> Open projects
              </Link>
            </div>
          </div>

          <div className="border-t border-slate-200 bg-slate-950 p-6 text-white lg:border-l lg:border-t-0 md:p-8">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-slate-300">Local API</p>
                <p className="mt-1 text-2xl font-semibold">{apiState === 'online' ? 'Connected' : 'Mock fallback'}</p>
              </div>
              <span className={`h-3 w-3 rounded-full ${apiState === 'online' ? 'bg-emerald-400' : 'bg-amber-300'}`} />
            </div>
            <div className="mt-8 grid grid-cols-3 gap-3">
              <Metric label="Projects" value={projects.length} />
              <Metric label="Runs" value={runs.length} />
              <Metric label="Active" value={activeRuns} />
            </div>
          </div>
        </div>
      </section>

      <section className="grid gap-6 lg:grid-cols-[1fr_360px]">
        <div className="rounded-lg border border-slate-200 bg-white p-5">
          <div className="mb-4 flex items-center justify-between gap-3">
            <div>
              <h2 className="text-lg font-semibold text-slate-950">Project pipeline</h2>
              <p className="text-sm text-slate-500">The latest status for each design project.</p>
            </div>
            {loading && <span className="text-xs font-medium text-slate-500">Syncing...</span>}
          </div>

          <div className="grid gap-3">
            {projects.map((project) => {
              const latestRun = latestRunByProject.get(project.id);
              const health = projectHealth(latestRun?.status);

              return (
                <Link
                  key={project.id}
                  href={`/projects/${project.id}`}
                  className="group grid gap-4 rounded-lg border border-slate-200 p-4 transition hover:border-slate-300 hover:bg-slate-50 md:grid-cols-[1fr_auto]"
                >
                  <div>
                    <div className="flex flex-wrap items-center gap-2">
                      <h3 className="font-semibold text-slate-950">{project.title}</h3>
                      <span className={`rounded-full px-2 py-0.5 text-xs font-medium ring-1 ${health.tone}`}>
                        {health.label}
                      </span>
                    </div>
                    <p className="mt-1 line-clamp-2 text-sm text-slate-600">
                      {project.description || project.brief || 'No description yet.'}
                    </p>
                  </div>
                  <div className="grid grid-cols-3 gap-3 text-sm md:min-w-64">
                    <SmallStat label="Runs" value={runs.filter((run) => run.project_id === project.id).length} />
                    <SmallStat label="Latest" value={latestRun ? formatDate(latestRun.created_at) : 'None'} />
                    <SmallStat label="Type" value={project.product_type} />
                  </div>
                </Link>
              );
            })}
          </div>
        </div>

        <aside className="space-y-6">
          <div className="rounded-lg border border-slate-200 bg-white p-5">
            <div className="mb-4 flex items-center gap-2">
              <IconChart />
              <h2 className="text-lg font-semibold text-slate-950">Recent runs</h2>
            </div>

            <div className="space-y-3">
              {recentRuns.map((run) => {
                const health = projectHealth(run.status);

                return (
                  <Link
                    key={run.run_id}
                    href={`/dashboard/runs/${run.run_id}`}
                    className="block rounded-md border border-slate-200 p-3 transition hover:bg-slate-50"
                  >
                    <div className="flex items-center justify-between gap-3">
                      <span className="truncate font-mono text-xs text-slate-700">{run.run_id}</span>
                      <span className={`shrink-0 rounded-full px-2 py-0.5 text-xs font-medium ring-1 ${health.tone}`}>
                        {health.label}
                      </span>
                    </div>
                    <div className="mt-2 flex items-center justify-between text-xs text-slate-500">
                      <span>{formatDate(run.created_at)}</span>
                      <span>{variantCounts[run.run_id] ?? 0} variants</span>
                    </div>
                  </Link>
                );
              })}
            </div>
          </div>

          <div className="rounded-lg border border-slate-200 bg-white p-5">
            <h2 className="text-lg font-semibold text-slate-950">Next best step</h2>
            <p className="mt-2 text-sm leading-6 text-slate-600">
              Create a project, add a clear brief, launch a run, then review generated variants with the DfX scorecard.
            </p>
            <Link
              href={projects[0] ? `/projects/${projects[0].id}/generate` : '/projects/create'}
              className="mt-4 inline-flex w-full items-center justify-center gap-2 rounded-md bg-blue-600 px-4 py-2 text-sm font-semibold text-white transition hover:bg-blue-700"
            >
              <IconPlay /> Start generation
            </Link>
          </div>
        </aside>
      </section>

      <div className="grid gap-4 sm:grid-cols-3">
        <MetricCard label="Completed runs" value={completedRuns} />
        <MetricCard label="Queued or running" value={activeRuns} />
        <MetricCard label="Tracked variants" value={Object.values(variantCounts).reduce((sum, count) => sum + count, 0)} />
      </div>
    </div>
  );
}

function Metric({ label, value }: { label: string; value: number }) {
  return (
    <div className="rounded-md bg-white/10 p-3 ring-1 ring-white/15">
      <p className="text-xs text-slate-300">{label}</p>
      <p className="mt-1 text-2xl font-semibold">{value}</p>
    </div>
  );
}

function MetricCard({ label, value }: { label: string; value: number }) {
  return (
    <div className="rounded-lg border border-slate-200 bg-white p-4">
      <p className="text-sm text-slate-500">{label}</p>
      <p className="mt-2 text-2xl font-semibold text-slate-950">{value}</p>
    </div>
  );
}

function SmallStat({ label, value }: { label: string; value: ReactNode }) {
  return (
    <div>
      <p className="text-xs text-slate-500">{label}</p>
      <p className="mt-1 truncate font-medium text-slate-800">{value}</p>
    </div>
  );
}
