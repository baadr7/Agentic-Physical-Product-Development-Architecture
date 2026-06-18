import { NavLink } from 'react-router-dom';
import { Settings, HelpCircle, Hexagon, Languages, Sun, Moon } from 'lucide-react';
import { useT, useLangStore } from '@/i18n';
import { useAppState } from '@/store/appState';
import { useThemeStore } from '@/theme';

const NAV: { to: string; key: string }[] = [
  { to: '/e1', key: 'nav.e1' },
  { to: '/e2', key: 'nav.e2' },
  { to: '/e3', key: 'nav.e3' },
  { to: '/workflow', key: 'nav.workflow' },
  { to: '/e4', key: 'nav.e4' },
  { to: '/e6', key: 'nav.e6' },
  { to: '/e7', key: 'nav.e7' },
];

export default function Header({ onOpenSettings }: { onOpenSettings?: () => void }) {
  const t = useT();
  const toggleLang = useLangStore((s) => s.toggle);
  const theme = useThemeStore((s) => s.theme);
  const toggleTheme = useThemeStore((s) => s.toggle);
  const scenarioName = useAppState((s) => s.scenarioName);
  const demoMode = useAppState((s) => s.demoMode);

  return (
    <header className="sticky top-0 z-40 border-b border-border bg-surface-raised/95 backdrop-blur">
      <div className="mx-auto flex h-14 max-w-app items-center gap-4 px-4">
        {/* brand */}
        <div className="flex items-center gap-2">
          <div className="grid h-7 w-7 place-items-center rounded bg-human text-white">
            <Hexagon size={16} strokeWidth={2.4} />
          </div>
          <div className="leading-tight">
            <div className="text-section font-semibold">{t('app.name')}</div>
          </div>
        </div>

        {/* PDP phase banner (Layer 0, simulated) */}
        <div className="hidden items-center gap-2 rounded border border-border bg-surface px-2.5 py-1 lg:flex">
          <span className="text-caption uppercase tracking-wide text-text-muted">
            {t('shell.pdpPhase')}
          </span>
          <span className="text-caption font-medium text-text-secondary">
            {t('shell.pdp.conception')}
          </span>
          <span className="pill bg-surface-overlay text-status-simulated">
            {t('common.simulated')}
          </span>
        </div>

        {/* scenario chip */}
        <div className="hidden items-center gap-2 rounded border border-border bg-surface px-2.5 py-1 md:flex">
          <span className="text-caption uppercase tracking-wide text-text-muted">
            {t('shell.scenario')}
          </span>
          <span className="text-caption font-medium text-text-primary">
            {scenarioName || t('shell.noScenario')}
          </span>
        </div>

        {/* nav */}
        <nav className="ml-2 hidden items-center gap-0.5 xl:flex">
          {NAV.map((n) => (
            <NavLink
              key={n.to}
              to={n.to}
              className={({ isActive }) =>
                `rounded px-2.5 py-1.5 text-body font-medium transition-colors ${
                  isActive
                    ? 'bg-surface-overlay text-text-primary'
                    : 'text-text-secondary hover:text-text-primary'
                }`
              }
            >
              {t(n.key)}
            </NavLink>
          ))}
        </nav>

        <div className="ml-auto flex items-center gap-2">
          {/* API status badge */}
          <span
            className={`pill ${
              demoMode
                ? 'bg-amber-500/15 text-status-warning'
                : 'bg-emerald-500/15 text-status-pass'
            }`}
          >
            <span
              className={`h-1.5 w-1.5 rounded-full ${
                demoMode ? 'bg-status-warning' : 'bg-status-pass'
              }`}
            />
            {demoMode ? t('shell.demoMode') : t('shell.connected')}
          </span>

          {/* language toggle */}
          <button
            onClick={toggleLang}
            className="btn-ghost gap-1 px-2 py-1.5 text-caption font-semibold"
            title="FR / EN"
          >
            <Languages size={14} />
            {t('shell.lang')}
          </button>

          {/* theme toggle */}
          <button
            onClick={toggleTheme}
            className="btn-ghost px-2 py-1.5"
            title={t('shell.theme')}
            aria-label={t('shell.theme')}
          >
            {theme === 'dark' ? <Sun size={16} /> : <Moon size={16} />}
          </button>

          {/* settings */}
          <button
            onClick={onOpenSettings}
            className="btn-ghost px-2 py-1.5"
            title={t('shell.settings')}
            aria-label={t('shell.settings')}
          >
            <Settings size={16} />
          </button>

          {/* glossary — fixed access on all screens */}
          <NavLink to="/e8" className="btn-ghost gap-1.5 px-2.5 py-1.5 text-body" title={t('shell.glossary')}>
            <HelpCircle size={15} />
            {t('shell.glossary')}
          </NavLink>
        </div>
      </div>
    </header>
  );
}
