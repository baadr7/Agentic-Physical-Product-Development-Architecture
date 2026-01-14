'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import pathsConfig from '~/config/paths.config';
import { IconHome, IconFolder, IconClipboard, IconPlay, IconChart, IconBeaker, IconPlus } from '~/components/icons';

function useCurrentProjectId() {
  const pathname = usePathname() || '';
  const m = pathname.match(/^\/projects\/([^\/]+)(?:\/.*)?$/);
  return m?.[1] || null;
}

export default function LeftSidebar() {
  const pid = useCurrentProjectId();

  const linkClasses = (enabled: boolean, active: boolean) =>
    `block text-left px-3 py-2 rounded-md transition ${
      active
        ? 'bg-blue-50 text-blue-900 border border-blue-200'
        : 'hover:bg-slate-50'
    } ${enabled ? 'text-slate-900' : 'text-slate-400 pointer-events-none'}`;

  const pathname = usePathname() || '';
  const isActive = (href: string) => pathname === href || pathname.startsWith(href + '/');

  // Helpers for project-aware links; if no project, send to projects list
  const p = (suffix: string) => (pid ? `/projects/${pid}${suffix}` : `/projects`);

  return (
    <aside className="sticky top-0 self-start bg-white rounded-lg border border-slate-200 p-4 w-full">
      <div className="space-y-4">
        <div className="flex items-center gap-3 p-3 rounded-md bg-gradient-to-r from-slate-900 to-slate-700 text-white">
          <div className="w-8 h-8 rounded bg-white/20 flex items-center justify-center font-bold">MK</div>
          <div className="text-sm font-semibold">Makerkit</div>
        </div>
        <div>
          <div className="text-[10px] uppercase tracking-wide text-slate-500 mb-2">Général</div>
          <nav className="flex flex-col gap-1">
            <Link href={pathsConfig.app.home} className={linkClasses(true, isActive(pathsConfig.app.home))}>
              <span className="inline-flex items-center gap-2"><IconHome /> Vision globale</span>
            </Link>
            <Link href="/projects" className={linkClasses(true, isActive('/projects'))}>
              <span className="inline-flex items-center gap-2"><IconFolder /> Projets</span>
            </Link>
          </nav>
        </div>
        <div className="border-t border-slate-200 pt-3">
          <div className="text-[10px] uppercase tracking-wide text-slate-500 mb-2">Projet</div>
          <nav className="flex flex-col gap-1">
            <Link href={p('')} className={linkClasses(!!pid, isActive(p('')))}>
              <span className="inline-flex items-center gap-2"><IconClipboard /> Détails du projet</span>
            </Link>
            <Link href={p('/generate')} className={linkClasses(!!pid, isActive(p('/generate')))}>
              <span className="inline-flex items-center gap-2"><IconPlay /> Générer</span>
            </Link>
            <Link href={p('/results')} className={linkClasses(!!pid, isActive(p('/results')))}>
              <span className="inline-flex items-center gap-2"><IconChart /> Résultats</span>
            </Link>
            <Link href={p('/dfx')} className={linkClasses(!!pid, isActive(p('/dfx')))}>
              <span className="inline-flex items-center gap-2"><IconBeaker /> DfX</span>
            </Link>
            <Link href={p('/generate')} className={linkClasses(!!pid, false)}>
              <span className="inline-flex items-center gap-2"><IconPlus /> Ajouter un run</span>
            </Link>
          </nav>
        </div>
      </div>
    </aside>
  );
}
