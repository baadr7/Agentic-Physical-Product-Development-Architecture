import type { JwtPayload, SupabaseClient } from '@supabase/supabase-js';

import { checkRequiresMultiFactorAuthentication } from './check-requires-mfa';

const MULTI_FACTOR_AUTH_VERIFY_PATH = '/auth/verify';
const SIGN_IN_PATH = '/auth/sign-in';

/**
 * @name requireUser
 * @description Require a session to be present in the request
 * @param client
 */
export async function requireUser(client: SupabaseClient): Promise<
  | {
      error: null;
      data: JwtPayload;
    }
  | (
      | {
          error: AuthenticationError;
          data: null;
          redirectTo: string;
        }
      | {
          error: MultiFactorAuthError;
          data: null;
          redirectTo: string;
        }
    )
> {
  let data: { claims?: JwtPayload } | null = null;
  let error: unknown = null;
  try {
    const res = await client.auth.getClaims();
    data = res?.data ?? null;
    error = res?.error ?? null;
  } catch (e) {
    // Network/config errors (e.g. wrong Supabase URL, local Supabase not running)
    // can throw at fetch() level in server components. Treat as unauthenticated.
    error = e;
    data = null;
  }

  if (!data?.claims || error) {
    return {
      data: null,
      error: new AuthenticationError(),
      redirectTo: SIGN_IN_PATH,
    };
  }

  const requiresMfa = await checkRequiresMultiFactorAuthentication(client);

  // If the user requires multi-factor authentication,
  // redirect them to the page where they can verify their identity.
  if (requiresMfa) {
    return {
      data: null,
      error: new MultiFactorAuthError(),
      redirectTo: MULTI_FACTOR_AUTH_VERIFY_PATH,
    };
  }

  return {
    error: null,
    data: {
      ...data.claims,
      id: data.claims.sub,
    },
  };
}

class AuthenticationError extends Error {
  constructor() {
    super(`Authentication required`);
  }
}

class MultiFactorAuthError extends Error {
  constructor() {
    super(`Multi-factor authentication required`);
  }
}
