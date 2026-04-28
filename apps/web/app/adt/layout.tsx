import type { ReactNode } from 'react';
import { requireUserInServerComponent } from '~/lib/server/require-user-in-server-component';
import { AdtStateProvider } from '~/lib/adt/appState';
import AdtGlossaire from '~/adt/_components/AdtGlossaire';

/**
 * ADT Layout — forces dark context for the entire ADT workflow.
 * Wraps all screens with AppState provider + persistent Glossaire button.
 */
export default async function AdtLayout({ children }: { children: ReactNode }) {
  await requireUserInServerComponent();

  return (
    <AdtStateProvider>
      <div
        className="dark"
        style={{
          minHeight: '100%',
          background: 'linear-gradient(135deg, #060d1f 0%, #0b1529 40%, #0d1a35 100%)',
          borderRadius: 16,
          padding: '4px 0',
          position: 'relative',
        }}
      >
        {children}
        <AdtGlossaire />
      </div>
    </AdtStateProvider>
  );
}
