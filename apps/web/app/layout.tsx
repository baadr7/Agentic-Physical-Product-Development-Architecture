import { cookies } from 'next/headers';

import { Toaster } from '@kit/ui/sonner';
import { cn } from '@kit/ui/utils';

import { RootProviders } from '~/components/root-providers';
import { heading, sans } from '~/lib/fonts';
import { createI18nServerInstance } from '~/lib/i18n/i18n.server';
import { generateRootMetadata } from '~/lib/root-metdata';

import '../styles/globals.css';
import NavBar from '~/components/NavBar';
import AppShell from '~/components/AppShell';

export default async function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const { language } = await createI18nServerInstance();
  const theme = await getTheme();
  const className = getBaseClassName();
  const hideTopNav = process.env.NEXT_PUBLIC_HIDE_TOP_NAV === 'true';

  return (
    <html lang={language} className={className} suppressHydrationWarning>
      <body>
        <RootProviders theme={theme} lang={language}>
          {!hideTopNav && <NavBar />}
          <AppShell>{children}</AppShell>
        </RootProviders>

        <Toaster richColors={true} theme={theme} position="top-center" />
      </body>
    </html>
  );
}

function getBaseClassName() {
  const font = [sans.variable, heading.variable].reduce<string[]>(
    (acc, curr) => (acc.includes(curr) ? acc : [...acc, curr]),
    [],
  );

  // Theme classes (dark/light) are applied client-side by next-themes.
  return cn('bg-background min-h-screen antialiased', ...font);
}

async function getTheme() {
  const cookiesStore = await cookies();
  return cookiesStore.get('theme')?.value as 'light' | 'dark' | 'system';
}

export const generateMetadata = generateRootMetadata;
