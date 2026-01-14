'use client';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { IconHome, IconFolder } from '~/components/icons';
import ThemeToggle from '~/components/ThemeToggle';
import pathsConfig from '~/config/paths.config';

const links = [
  { href: pathsConfig.app.home, label: 'Vision globale', icon: IconHome },
  { href: '/projects', label: 'Projets', icon: IconFolder },
];

export default function NavBar() {
  const pathname = usePathname();
  return (
    <nav className="w-full border-b bg-white">
      <div className="mx-auto max-w-6xl px-4 py-3 flex items-center justify-between">
        <div className="flex items-center gap-6">
          <Link href="/" className="font-semibold text-slate-900">Makerkit</Link>
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