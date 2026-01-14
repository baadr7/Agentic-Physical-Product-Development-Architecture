'use client';

import { useAuthChangeListener } from '@kit/supabase/hooks/use-auth-change-listener';

import pathsConfig from '~/config/paths.config';

export function AuthProvider(props: React.PropsWithChildren) {
  const demoMode = process.env.NEXT_PUBLIC_DEMO_MODE === 'true';
  const disableAuth = process.env.NEXT_PUBLIC_DISABLE_AUTH === 'true' || demoMode;
  if (!disableAuth) {
    useAuthChangeListener({
      appHomePath: pathsConfig.app.home,
    });
  }

  return props.children;
}
