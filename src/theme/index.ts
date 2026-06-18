import { create } from 'zustand';
import { persist } from 'zustand/middleware';

export type Theme = 'dark' | 'light';

/**
 * Color tokens for canvas / inline-SVG consumers (Chart.js, the workflow graph,
 * the parametric valve drawing) that cannot read the Tailwind CSS variables.
 * Keep these in sync with the --surface / --border / --text-* custom properties
 * defined in src/index.css.
 */
export interface ThemeTokens {
  surface: string;
  surfaceRaised: string;
  surfaceOverlay: string;
  border: string;
  borderStrong: string;
  textPrimary: string;
  textSecondary: string;
  textMuted: string;
}

export const THEME_TOKENS: Record<Theme, ThemeTokens> = {
  dark: {
    surface: '#0F1419',
    surfaceRaised: '#161C23',
    surfaceOverlay: '#1E2630',
    border: '#2A3441',
    borderStrong: '#3D4A5C',
    textPrimary: '#E6EBF0',
    textSecondary: '#9AA7B5',
    textMuted: '#5E6B7A',
  },
  light: {
    surface: '#F3F5F8',
    surfaceRaised: '#FFFFFF',
    surfaceOverlay: '#E8ECF2',
    border: '#D6DDE6',
    borderStrong: '#B8C2CF',
    textPrimary: '#11181F',
    textSecondary: '#475569',
    textMuted: '#64748B',
  },
};

/** Reflect the active theme onto <html data-theme> so the CSS variables swap. */
export function applyTheme(theme: Theme) {
  if (typeof document !== 'undefined') {
    document.documentElement.dataset.theme = theme;
  }
}

interface ThemeState {
  theme: Theme;
  setTheme: (t: Theme) => void;
  toggle: () => void;
}

export const useThemeStore = create<ThemeState>()(
  persist(
    (set, get) => ({
      theme: 'dark',
      setTheme: (theme) => {
        applyTheme(theme);
        set({ theme });
      },
      toggle: () => {
        const next: Theme = get().theme === 'dark' ? 'light' : 'dark';
        applyTheme(next);
        set({ theme: next });
      },
    }),
    {
      name: 'apda-theme',
      // re-assert the attribute after hydration (the inline boot script in
      // index.html sets it first to avoid a flash).
      onRehydrateStorage: () => (state) => {
        if (state) applyTheme(state.theme);
      },
    },
  ),
);

/** Reactive theme color tokens for JS-driven renderers (charts, SVG). */
export function useThemeTokens(): ThemeTokens {
  const theme = useThemeStore((s) => s.theme);
  return THEME_TOKENS[theme];
}
