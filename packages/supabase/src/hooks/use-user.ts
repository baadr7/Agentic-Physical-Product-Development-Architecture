import type { JwtPayload } from '@supabase/supabase-js';

import { useQuery } from '@tanstack/react-query';

import { useSupabase } from './use-supabase';
import { isSupabaseDisabled } from '../get-supabase-client-keys';

const queryKey = ['supabase:user'];

/**
 * @name useUser
 * @description Use Supabase to get the current user in a React component
 * @param initialData
 */
export function useUser(initialData?: JwtPayload | null) {
  const client = useSupabase();
  const disabled = isSupabaseDisabled();

  const queryFn = async () => {
    if (disabled) {
      // Provide a stable fake user for UI-only local development.
      const now = Math.floor(Date.now() / 1000);
      return {
        sub: 'dev-user',
        email: 'dev@example.com',
        role: 'authenticated',
        aud: 'authenticated',
        // RequiredClaims (supabase-js)
        iss: 'dev',
        iat: now,
        exp: now + 60 * 60 * 24 * 365,
        aal: 'aal1',
        session_id: 'dev-session',
      } as unknown as JwtPayload;
    }

    const response = await client.auth.getClaims();

    if (response.error) {
      return undefined;
    }

    if (response.data?.claims) {
      return response.data.claims;
    }

    return Promise.reject(new Error('Unexpected result format'));
  };

  return useQuery({
    queryFn,
    queryKey,
    initialData: disabled ? undefined : initialData,
    refetchInterval: disabled ? false : undefined,
    refetchOnMount: disabled ? false : undefined,
    refetchOnWindowFocus: disabled ? false : undefined,
  });
}
