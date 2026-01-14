import type { SignInWithPasswordCredentials } from '@supabase/supabase-js';

import { useMutation } from '@tanstack/react-query';

import { useSupabase } from './use-supabase';
import { isSupabaseDisabled } from '../get-supabase-client-keys';

/**
 * @name useSignInWithEmailPassword
 * @description Use Supabase to sign in a user with email and password in a React component
 */
export function useSignInWithEmailPassword() {
  const client = useSupabase();
  const mutationKey = ['auth', 'sign-in-with-email-password'];

  const mutationFn = async (credentials: SignInWithPasswordCredentials) => {
    // Preflight: validate env configuration early with clear errors
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL ?? '';
    const supabaseAnon = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ?? '';
    if (!supabaseUrl || !supabaseAnon) {
      const missing = [!supabaseUrl && 'NEXT_PUBLIC_SUPABASE_URL', !supabaseAnon && 'NEXT_PUBLIC_SUPABASE_ANON_KEY']
        .filter(Boolean)
        .join(', ');
      throw new Error(`Supabase not configured. Missing: ${missing}. Add them to apps/web/.env.local`);
    }
    try {
      const parsed = new URL(supabaseUrl);
      if (!parsed.hostname.endsWith('supabase.co')) {
        throw new Error('Invalid Supabase hostname');
      }
    } catch {
      throw new Error(`Invalid NEXT_PUBLIC_SUPABASE_URL: ${supabaseUrl}. Expected https://<project-ref>.supabase.co`);
    }
    if (isSupabaseDisabled()) {
      console.warn('[auth] signInWithEmailPassword ignored: auth disabled');
      return {} as never;
    }

    let response;
    try {
      response = await client.auth.signInWithPassword(credentials);
    } catch (e: any) {
      const url = process.env.NEXT_PUBLIC_SUPABASE_URL ?? '';
      const anonKey = (process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ?? '').slice(0, 6) + '…';
      const msg = e?.message || 'Failed to fetch';
      throw new Error(`[supabase-auth] ${msg}. Check NEXT_PUBLIC_SUPABASE_URL (${url}) and ANON_KEY (${anonKey}).`);
    }

    if (response.error) {
      throw response.error.message;
    }

    // Return full auth response; upstream UI can decide what to show.
    // Removing identities length heuristic which produced confusing errors.
    return response.data;
  };

  return useMutation({ mutationKey, mutationFn });
}
