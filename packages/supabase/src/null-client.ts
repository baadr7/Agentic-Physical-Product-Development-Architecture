import type { SupabaseClient } from '@supabase/supabase-js';

/**
 * Very small no-op Supabase client used when auth is disabled or keys are missing.
 * Only implements methods that are safely used throughout the app during anon usage.
 */
export function createNullClient(): SupabaseClient<any, any, any> {
  const noopPromise = Promise.resolve({ error: null } as any);

  const buildDisabledError = (message: string = 'Auth disabled'): any => ({
    message,
    status: 0,
    name: 'AuthDisabledError',
  });

  const auth = {
    async getClaims() {
      return { data: { claims: null }, error: null } as const;
    },
    async getUser() {
      return { data: { user: null }, error: null } as const;
    },
    async updateUser() {
      return { data: null, error: buildDisabledError() } as const;
    },
    async resend() {
      return { data: null, error: buildDisabledError() } as const;
    },
    async resetPasswordForEmail() {
      return { data: null, error: buildDisabledError() } as const;
    },
    async signInWithOAuth() {
      return { data: null, error: buildDisabledError() } as const;
    },
    async signInWithOtp() {
      return { data: null, error: buildDisabledError() } as const;
    },
    async signInWithPassword() {
      return { data: null, error: buildDisabledError() } as const;
    },
    async signUp() {
      return { data: null, error: buildDisabledError() } as const;
    },
    onAuthStateChange() {
      return {
        data: { subscription: { unsubscribe() {/* noop */} } },
        error: null,
      } as const;
    },
    async signOut() {
      return { error: null } as const;
    },
    mfa: {
      async listFactors() {
        return { data: { all: [], totp: [], phone: [] }, error: null } as const;
      },
      async enroll() {
        return { data: null, error: buildDisabledError() } as const;
      },
      async unenroll() {
        return { data: null, error: buildDisabledError() } as const;
      },
      async challenge() {
        return { data: { id: null }, error: buildDisabledError() } as const;
      },
      async verify() {
        return { data: null, error: buildDisabledError() } as const;
      },
    },
  } as any;

  const from = () => {
    const builder = {
      select: () => builder,
      update: () => builder,
      insert: () => builder,
      match: () => builder,
      eq: () => builder,
      single: async () => ({ data: null, error: null } as const),
    };

    return builder as any;
  };

  return {
    auth,
    from,
  } as unknown as SupabaseClient<any, any, any>;
}
