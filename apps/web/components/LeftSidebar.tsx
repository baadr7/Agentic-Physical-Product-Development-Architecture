'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';

import {
  IconBeaker,
  IconChart,
  IconClipboard,
  IconFolder,
  IconHome,
  IconPlay,
  IconPlus,
  IconSparkles,
} from '~/components/icons';
import pathsConfig from '~/config/paths.config';

function useCurrentProjectId() {
  const pathname = usePathname() || '';
  const match = pathname.match(/^\/projects\/([^/]+)(?:\/.*)?$/);

  return match?.[1] || null;
}

export default function LeftSidebar() {
  const pathname = usePathname() || '';
  const projectId = useCurrentProjectId();
  const projectHref = (suffix: string) => (projectId ? `/projects/${projectId}${suffix}` : '/projects');

  const isActive = (href: string) => pathname === href || pathname.startsWith(`${href}/`);
  const linkClasses = (enabled: boolean, active: boolean) =>
    `flex items-center gap-2 rounded-md px-3 py-2 text-sm transition ${
      active
        ? 'bg-slate-950 text-white'
        : enabled
          ? 'text-slate-700 hover:bg-slate-100 hover:text-slate-950'
          : 'pointer-events-none text-slate-400'
    }`;

  return (
    <aside className="sticky top-4 w-full rounded-lg border border-slate-200 bg-white p-4">
      <div className="mb-5 flex items-center gap-3 rounded-md bg-slate-950 p-3 text-white">
        <span className="inline-flex h-9 w-9 items-center justify-center rounded-md bg-white/10">
          <IconSparkles />
        </span>
        <div>
          <p className="text-sm font-semibold">AI for Design</p>
          <p className="text-xs text-slate-300">Concept to DfX</p>
        </div>
      </div>

      <nav className="space-y-5">
        <div>
          <p className="mb-2 px-3 text-xs font-semibold uppercase tracking-wide text-slate-500">
            Workspace
          </p>
          <div className="space-y-1">
            <Link href={pathsConfig.app.home} className={linkClasses(true, isActive(pathsConfig.app.home))}>
              <IconHome /> Dashboard
            </Link>
            <Link href="/projects" className={linkClasses(true, isActive('/projects'))}>
              <IconFolder /> Projects
            </Link>
          </div>
        </div>

        <div>
          <p className="mb-2 px-3 text-xs font-semibold uppercase tracking-wide text-slate-500">
            Current project
          </p>
          <div className="space-y-1">
            <Link href={projectHref('')} className={linkClasses(Boolean(projectId), projectId ? isActive(projectHref('')) : false)}>
              <IconClipboard /> Details
            </Link>
            <Link href={projectHref('/generate')} className={linkClasses(Boolean(projectId), isActive(projectHref('/generate')))}>
              <IconPlay /> Generate
            </Link>
            <Link href={projectHref('/results')} className={linkClasses(Boolean(projectId), isActive(projectHref('/results')))}>
              <IconChart /> Results
            </Link>
            <Link href={projectHref('/dfx')} className={linkClasses(Boolean(projectId), isActive(projectHref('/dfx')))}>
              <IconBeaker /> DfX review
            </Link>
            <Link href={projectHref('/generate')} className={linkClasses(Boolean(projectId), false)}>
              <IconPlus /> Add run
            </Link>
          </div>
        </div>
      </nav>
    </aside>
  );
}
