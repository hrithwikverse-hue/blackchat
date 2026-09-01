/**
 * lib/supabase/client.ts
 *
 * Browser-side Supabase client.
 * Uses the public anon key — safe for browser use.
 * Relies on @supabase/ssr for cookie-based session management.
 */

import { createBrowserClient } from '@supabase/ssr'

export function createClient() {
  return createBrowserClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  )
}
