import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import { dictionary, type Lang } from './dictionary';

interface LangState {
  lang: Lang;
  setLang: (l: Lang) => void;
  toggle: () => void;
}

export const useLangStore = create<LangState>()(
  persist(
    (set, get) => ({
      lang: 'fr',
      setLang: (lang) => set({ lang }),
      toggle: () => set({ lang: get().lang === 'fr' ? 'en' : 'fr' }),
    }),
    { name: 'apda-lang' },
  ),
);

/** Translate a key for an explicit language. Falls back to the key itself. */
export function translate(key: string, lang: Lang): string {
  const entry = dictionary[key];
  if (!entry) return key;
  return entry[lang] ?? entry.fr ?? key;
}

/** Hook returning a reactive translator bound to the current language. */
export function useT() {
  const lang = useLangStore((s) => s.lang);
  return (key: string) => translate(key, lang);
}

export type { Lang };
