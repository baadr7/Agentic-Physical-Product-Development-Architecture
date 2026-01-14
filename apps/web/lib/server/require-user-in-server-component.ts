import 'server-only';

import { cache } from 'react';

import { redirect } from 'next/navigation';

import { requireUser } from '@kit/supabase/require-user';
import { getSupabaseServerClient } from '@kit/supabase/server-client';

/**
 * @name requireUserInServerComponent
 * @description Require the user to be authenticated in a server component.
 * We reuse this function in multiple server components - it is cached so that the data is only fetched once per request.
 * Use this instead of `requireUser` in server components, so you don't need to hit the database multiple times in a single request.
 */
export const requireUserInServerComponent = cache(async () => {
  const demoMode =
    process.env.NEXT_PUBLIC_DEMO_MODE === 'true' || process.env.DEMO_MODE === 'true';
  const disableAuth = process.env.NEXT_PUBLIC_DISABLE_AUTH === 'true' || demoMode;

  // Demo/auth-disabled mode: return a stable stub user so server components
  // (like /home layout) can render without Supabase session.
  if (disableAuth) {
    return {
      aud: 'authenticated',
      exp: Math.floor(Date.now() / 1000) + 60 * 60,
      sub: 'demo-user',
      email: 'demo@local',
      role: 'authenticated',
      app_metadata: { provider: 'demo' },
      user_metadata: {},
    } as any;
  }

  const client = getSupabaseServerClient();
  const result = await requireUser(client);

  if (result.error) {
    redirect(result.redirectTo);
  }

  return result.data;
});
