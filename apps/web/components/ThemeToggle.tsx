'use client';

import { useEffect, useState } from 'react';

export default function ThemeToggle() {
  const [isDark, setIsDark] = useState(false);

  useEffect(() => {
    try {
      const stored = localStorage.getItem('theme');
      const prefersDark = window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches;
      const next = stored ? stored === 'dark' : prefersDark;
      setIsDark(next);
      document.documentElement.classList.toggle('dark', next);
      document.documentElement.setAttribute('data-theme', next ? 'dark' : 'light');
    } catch {
      // noop
    }
  }, []);

  function toggle() {
    const next = !isDark;
    setIsDark(next);
    try {
      localStorage.setItem('theme', next ? 'dark' : 'light');
    } catch {
      // noop
    }
    document.documentElement.classList.toggle('dark', next);
    document.documentElement.setAttribute('data-theme', next ? 'dark' : 'light');
  }

  return (
    <button
      type="button"
      onClick={toggle}
      aria-label={isDark ? 'Activer le thème clair' : 'Activer le thème sombre'}
      title={isDark ? 'Thème clair' : 'Thème sombre'}
      className="inline-flex items-center gap-2 rounded-md border border-slate-200 bg-white px-3 py-1.5 text-sm hover:bg-slate-50"
    >
      {isDark ? (
        // Sun icon
        <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor" className="h-4 w-4 text-amber-400">
          <path d="M12 18a6 6 0 1 0 0-12 6 6 0 0 0 0 12Z" />
          <path fillRule="evenodd" d="M12 2.25a.75.75 0 0 1 .75.75v1.5a.75.75 0 0 1-1.5 0V3A.75.75 0 0 1 12 2.25Zm0 16.5a.75.75 0 0 1 .75.75v1.5a.75.75 0 0 1-1.5 0V19.5a.75.75 0 0 1 .75-.75Zm9-7.5a.75.75 0 0 1-.75.75h-1.5a.75.75 0 0 1 0-1.5H20.25a.75.75 0 0 1 .75.75ZM6 12a.75.75 0 0 1-.75.75H3.75a.75.75 0 0 1 0-1.5H5.25A.75.75 0 0 1 6 12Zm12.728 6.728a.75.75 0 0 1-1.06 0l-1.06-1.06a.75.75 0 1 1 1.06-1.06l1.06 1.06c.293.293.293.768 0 1.06Zm-9.336-9.336a.75.75 0 0 1-1.06 0l-1.06-1.06a.75.75 0 1 1 1.06-1.06l1.06 1.06c.293.293.293.768 0 1.06Zm9.336-6.364a.75.75 0 0 1 0 1.06l-1.06 1.06a.75.75 0 1 1-1.06-1.06l1.06-1.06a.75.75 0 0 1 1.06 0ZM7.392 18.668a.75.75 0 0 1-1.06 0l-1.06-1.06a.75.75 0 0 1 1.06-1.06l1.06 1.06c.293.293.293.768 0 1.06Z" clipRule="evenodd" />
        </svg>
      ) : (
        // Moon icon
        <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor" className="h-4 w-4 text-indigo-600">
          <path fillRule="evenodd" d="M21.752 15.002A9 9 0 1 1 9 2.248a.75.75 0 0 1 .964.966 7.5 7.5 0 0 0 9.822 9.822.75.75 0 0 1 .966.966Z" clipRule="evenodd" />
        </svg>
      )}
      <span className="hidden sm:inline">{isDark ? 'Clair' : 'Sombre'}</span>
    </button>
  );
}
