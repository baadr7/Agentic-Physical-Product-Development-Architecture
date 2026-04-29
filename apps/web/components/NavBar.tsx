'use client';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { IconHome, IconFolder, IconSparkles } from '~/components/icons';
import ThemeToggle from '~/components/ThemeToggle';
import pathsConfig from '~/config/paths.config';

const links = [
  { href: pathsConfig.app.home, label: 'Vision globale', icon: IconHome },
  { href: '/projects', label: 'Projets', icon: IconFolder },
];

export default function NavBar() {
  const pathname = usePathname();
  return (
    <nav className="w-full border-b border-slate-200 bg-white/95 backdrop-blur">
      <div className="mx-auto flex max-w-7xl items-center justify-between px-4 py-3">
        <div className="flex items-center gap-6">
          <Link href="/" className="inline-flex items-center gap-2 font-semibold text-slate-950">
            <span className="inline-flex h-8 w-8 items-center justify-center rounded-md bg-slate-950 text-white">
              <IconSparkles />
            </span>
            AI for Design
          </Link>
          {links.map(({ href, label, icon: Icon }) => {
            const active = pathname?.startsWith(href)
            return (
              <Link
                key={href}
                href={href}
                className={`text-sm inline-flex items-center gap-2 ${active ? 'text-indigo-700 font-semibold' : 'text-gray-600 hover:text-slate-900'}`}
              >
                <Icon />
                {label}
              </Link>
            )
          })}
        </div>
        <ThemeToggle />
      </div>
    </nav>
  );
}
