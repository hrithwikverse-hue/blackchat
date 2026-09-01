/**
 * lib/supabase/server.ts
 *
 * Server-side Supabase clients for use in:
 *  - Server Components
 *  - Server Actions
 *  - Route Handlers
 *
 * createServerClient()       → uses anon key, reads/writes cookies for session
 * createServiceRoleClient()  → uses service_role key, bypasses RLS for webhook processing
 *
 * NEVER import createServiceRoleClient() in client-side code.
 * The service role key is never sent to the browser.
 */

import { createServerClient as createSSRClient } from '@supabase/ssr'
import { createClient as createSupabaseClient } from '@supabase/supabase-js'
import { cookies } from 'next/headers'

/**
 * Server client for authenticated operations.
 * Uses cookie-based session, respects RLS.
 */
export async function createServerClient() {
  const cookieStore = await cookies()

  return createSSRClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return cookieStore.getAll()
        },
        setAll(cookiesToSet) {
          try {
            cookiesToSet.forEach(({ name, value, options }) =>
              cookieStore.set(name, value, options)
            )
          } catch {
            // Called from Server Component — cookie writes are no-ops
          }
        },
      },
    }
  )
}

/**
 * Service role client for webhook processing.
 * Bypasses RLS. Only use in server-side route handlers.
 * NEVER expose to browser.
 */
export function createServiceRoleClient() {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY

  if (!supabaseUrl || !serviceRoleKey) {
    throw new Error('[supabase] NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY must be set')
  }

  return createSupabaseClient(supabaseUrl, serviceRoleKey, {
    auth: {
      autoRefreshToken: false,
      persistSession: false,
    },
  })
}
