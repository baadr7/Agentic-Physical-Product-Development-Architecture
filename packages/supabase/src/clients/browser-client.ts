import { createBrowserClient } from '@supabase/ssr';

import { Database } from '../database.types';
import { getSupabaseClientKeys, isSupabaseDisabled } from '../get-supabase-client-keys';
import { createNullClient } from '../null-client';

/**
 * @name getSupabaseBrowserClient
 * @description Get a Supabase client for use in the Browser
 */
export function getSupabaseBrowserClient<GenericSchema = Database>() {
  if (isSupabaseDisabled()) {
    return createNullClient() as unknown as ReturnType<typeof createBrowserClient<GenericSchema>>;
  }

  const keys = getSupabaseClientKeys();
  return createBrowserClient<GenericSchema>(keys.url, keys.anonKey);
}
