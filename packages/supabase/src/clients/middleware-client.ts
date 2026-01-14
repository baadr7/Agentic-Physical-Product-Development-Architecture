import 'server-only';

import { type NextRequest, NextResponse } from 'next/server';

import { createServerClient } from '@supabase/ssr';

import { Database } from '../database.types';
import { getSupabaseClientKeys, isSupabaseDisabled } from '../get-supabase-client-keys';
import { createNullClient } from '../null-client';

/**
 * Creates a middleware client for Supabase.
 *
 * @param {NextRequest} request - The Next.js request object.
 * @param {NextResponse} response - The Next.js response object.
 */
export function createMiddlewareClient<GenericSchema = Database>(
  request: NextRequest,
  response: NextResponse,
) {
  if (isSupabaseDisabled()) {
    return createNullClient() as unknown as ReturnType<typeof createServerClient<GenericSchema>>;
  }

  const keys = getSupabaseClientKeys();

  return createServerClient<GenericSchema>(keys.url, keys.anonKey, {
    cookies: {
      getAll() {
        return request.cookies.getAll();
      },
      setAll(cookiesToSet) {
        cookiesToSet.forEach(({ name, value }) =>
          request.cookies.set(name, value),
        );

        cookiesToSet.forEach(({ name, value, options }) =>
          response.cookies.set(name, value, options),
        );
      },
    },
  });
}
