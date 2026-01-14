import 'server-only';

import { createClient } from '@supabase/supabase-js';

import { Database } from '../database.types';
import {
  getServiceRoleKey,
  warnServiceRoleKeyUsage,
} from '../get-service-role-key';
import { getSupabaseClientKeys, isSupabaseDisabled } from '../get-supabase-client-keys';
import { createNullClient } from '../null-client';

/**
 * @name getSupabaseServerAdminClient
 * @description Get a Supabase client for use in the Server with admin access to the database.
 */
export function getSupabaseServerAdminClient<GenericSchema = Database>() {
  warnServiceRoleKeyUsage();

  if (isSupabaseDisabled()) {
    return createNullClient() as unknown as ReturnType<typeof createClient<GenericSchema>>;
  }

  const url = getSupabaseClientKeys().url;

  return createClient<GenericSchema>(url, getServiceRoleKey(), {
    auth: {
      persistSession: false,
      detectSessionInUrl: false,
      autoRefreshToken: false,
    },
  });
}
