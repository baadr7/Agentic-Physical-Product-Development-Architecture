'use client';

import { useState } from 'react';
import LeftSidebar from '~/components/LeftSidebar';

export default function AppShell({ children }: { children: React.ReactNode }) {
  const [open, setOpen] = useState(false);
  return (
    <div className="mx-auto max-w-6xl px-4 py-6">
      <div className="md:hidden mb-3 flex items-center justify-between">
        <button
          type="button"
          onClick={() => setOpen((o) => !o)}
          className="inline-flex items-center justify-center px-3 py-2 rounded-lg bg-slate-900 text-white text-sm"
          aria-expanded={open}
          aria-controls="app-sidebar"
        >
          ☰ Menu
        </button>
      </div>
      <div className="grid grid-cols-12 gap-6">
        <div id="app-sidebar" className={`col-span-12 md:col-span-3 ${open ? '' : 'hidden md:block'}`}>
          <LeftSidebar />
        </div>
        <main className="col-span-12 md:col-span-9">{children}</main>
      </div>
    </div>
  );
}
