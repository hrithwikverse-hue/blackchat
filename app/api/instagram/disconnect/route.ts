/**
 * app/api/instagram/disconnect/route.ts
 * Marks the Instagram account as disconnected.
 */
import { NextResponse } from 'next/server'
import { createServerClient, createServiceRoleClient } from '@/lib/supabase/server'

export async function POST() {
  const supabase = await createServerClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const db = createServiceRoleClient()
  await db.from('instagram_accounts').update({ is_connected: false }).eq('is_connected', true)

  return NextResponse.json({ success: true })
}
