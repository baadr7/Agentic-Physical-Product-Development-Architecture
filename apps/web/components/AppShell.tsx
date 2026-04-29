'use client';

import { useState } from 'react';
import type { ReactNode } from 'react';
import { usePathname } from 'next/navigation';

import LeftSidebar from '~/components/LeftSidebar';

export default function AppShell({ children }: { children: ReactNode }) {
  const [open, setOpen] = useState(false);
  const pathname = usePathname() ?? '';
  const hideSidebar = pathname.startsWith('/adt');

  return (
    <div className="min-h-[calc(100vh-57px)] bg-slate-50">
      <div className="mx-auto max-w-7xl px-4 py-6">
        {!hideSidebar && (
          <div className="mb-3 flex items-center justify-between md:hidden">
            <button
              type="button"
              onClick={() => setOpen((value) => !value)}
              className="inline-flex items-center justify-center rounded-md bg-slate-950 px-3 py-2 text-sm text-white"
              aria-expanded={open}
              aria-controls="app-sidebar"
            >
              Menu
            </button>
          </div>
        )}

        <div className="grid grid-cols-12 gap-6">
          {!hideSidebar && (
            <div
              id="app-sidebar"
              className={`col-span-12 md:col-span-3 ${open ? '' : 'hidden md:block'}`}
            >
              <LeftSidebar />
            </div>
          )}
          <main className={hideSidebar ? 'col-span-12' : 'col-span-12 md:col-span-9'}>
            {children}
          </main>
        </div>
      </div>
    </div>
  );
}
