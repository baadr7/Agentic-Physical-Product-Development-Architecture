import type { SignInWithOAuthCredentials } from '@supabase/supabase-js';

import { useMutation } from '@tanstack/react-query';

import { useSupabase } from './use-supabase';
import { isSupabaseDisabled } from '../get-supabase-client-keys';

/**
 * @name useSignInWithProvider
 * @description Use Supabase to sign in a user with a provider in a React component
 */
export function useSignInWithProvider() {
  const client = useSupabase();
  const mutationKey = ['auth', 'sign-in-with-provider'];

  const mutationFn = async (credentials: SignInWithOAuthCredentials) => {
    // Gracefully no-op when auth disabled to avoid runtime errors
    if (isSupabaseDisabled()) {
      console.warn('[auth] signInWithProvider ignored: auth disabled');
      return {} as never;
    }

    const response = await client.auth.signInWithOAuth(credentials);

    if (response.error) {
      throw response.error.message;
    }

    return response.data;
  };

  return useMutation({
    mutationFn,
    mutationKey,
  });
}
