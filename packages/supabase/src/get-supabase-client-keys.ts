import { z } from 'zod';

/**
 * Returns true when Supabase auth should be disabled.
 * We disable when the explicit flag is set or when credentials are missing.
 */
export function isSupabaseDisabled() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL ?? '';
  const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ?? '';
  const flagDisabled = process.env.NEXT_PUBLIC_DISABLE_AUTH === 'true';

  return flagDisabled || !url || !anonKey;
}

/**
 * Returns and validates the Supabase client keys from the environment.
 * When auth is disabled, returns empty keys and relies on callers to short-circuit.
 */
export function getSupabaseClientKeys() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

  if (isSupabaseDisabled()) {
    // Return placeholders; callers are expected to not initialize a real client when disabled
    return { url: url ?? '', anonKey: anonKey ?? '' } as { url: string; anonKey: string };
  }

  return z
    .object({
      url: z.string().min(1),
      anonKey: z.string().min(1),
    })
    .parse({
      url,
      anonKey,
    });
}
