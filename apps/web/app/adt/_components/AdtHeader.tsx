'use client';

import Link from 'next/link';
import { usePathname, useSearchParams } from 'next/navigation';

const STEPS = [
  { id: 'scenario', label: 'Scenario', shortLabel: 'E1', href: '/adt/scenario' },
  { id: 'config',   label: 'Config',   shortLabel: 'E2', href: '/adt/config'   },
  { id: 'agents',   label: 'Agents',   shortLabel: 'E3', href: '/adt/agents'   },
  { id: 'concepts', label: 'Concepts', shortLabel: 'E4', href: '/adt/concepts' },
  { id: 'detail',   label: 'Detail',   shortLabel: 'E5', href: '/adt/detail'   },
  { id: 'select',   label: 'Select',   shortLabel: 'E6', href: '/adt/select'   },
  { id: 'gate',     label: 'Gate',     shortLabel: 'E7', href: '/adt/gate'     },
];

function buildHref(
  baseHref: string,
  projectId?: string | null,
  runId?: string | null,
  jobId?: string | null,
  variantId?: string | null,
) {
  const sp = new URLSearchParams();
  if (projectId) sp.set('projectId', projectId);
  if (runId)     sp.set('runId', runId);
  if (jobId)     sp.set('jobId', jobId);
  if (variantId) sp.set('variantId', variantId);
  const qs = sp.toString();
  return qs ? `${baseHref}?${qs}` : baseHref;
}

function getStepStatus(stepIndex: number, activeIndex: number) {
  if (stepIndex < activeIndex) return 'done';
  if (stepIndex === activeIndex) return 'active';
  return 'pending';
}

export default function AdtHeader() {
  const pathname   = usePathname() ?? '';
  const sp         = useSearchParams();
  const projectId  = sp?.get('projectId');
  const runId      = sp?.get('runId');
  const jobId      = sp?.get('jobId');
  const variantId  = sp?.get('variantId');

  const activeIndex = STEPS.findIndex((s) => pathname.startsWith(s.href));

  return (
    <div className="adt-header adt-root">
      {/* Top row */}
      <div className="flex flex-wrap items-start justify-between gap-3 mb-5">
        <div>
          <div className="adt-metric-label mb-1">Automated Design Thread</div>
          <h1 className="text-xl font-bold text-white" style={{ letterSpacing: '-0.02em' }}>
            Stage-Gate Industrial Workflow
          </h1>
          <div className="adt-accent-line mt-2" style={{ width: 80 }} />
        </div>

        {/* Meta badges */}
        <div className="flex flex-wrap gap-2 items-center text-xs">
          {projectId ? (
            <span
              className="adt-status-pill pending"
              style={{ fontFamily: 'monospace' }}
              title="Project ID"
            >
              PROJ {projectId.slice(0, 12)}…
            </span>
          ) : null}
          {runId ? (
            <span
              className="adt-status-pill running"
              style={{ fontFamily: 'monospace' }}
              title="Run ID"
            >
              RUN {runId.slice(0, 12)}…
            </span>
          ) : null}
          <span className="adt-gate-badge" style={{ background: 'rgba(6,182,212,0.12)', color: '#06b6d4', border: '1px solid rgba(6,182,212,0.3)' }}>
            EU AI Act
          </span>
        </div>
      </div>

      {/* Stepper */}
      <div className="adt-step-track">
        {STEPS.map((s, i) => {
          const status = getStepStatus(i, activeIndex < 0 ? 0 : activeIndex);
          const href   = buildHref(s.href, projectId, runId, jobId, variantId);
          return (
            <div key={s.id} className="flex items-center">
              <Link href={href} className={`adt-step-pill ${status}`}>
                <span className="hidden sm:inline">{s.label}</span>
                <span className="sm:hidden">{s.shortLabel}</span>
              </Link>
              {i < STEPS.length - 1 && <div className="adt-step-connector" />}
            </div>
          );
        })}
      </div>
    </div>
  );
}
