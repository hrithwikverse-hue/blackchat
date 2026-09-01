/**
 * app/api/automations/route.ts
 * GET  → list all automations
 * POST → create a new automation
 */

import { NextRequest, NextResponse } from 'next/server'
import { createServerClient, createServiceRoleClient } from '@/lib/supabase/server'
import { createAutomationSchema } from '@/lib/validation/schemas'

export async function GET() {
  const supabase = await createServerClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const db = createServiceRoleClient()

  const { data: automations, error } = await db
    .from('automations')
    .select(`
      *,
      automation_executions(count)
    `)
    .order('created_at', { ascending: false })

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  return NextResponse.json({ automations })
}

export async function POST(request: NextRequest) {
  const supabase = await createServerClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  let body: unknown
  try { body = await request.json() } catch { return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 }) }

  const parsed = createAutomationSchema.safeParse(body)
  if (!parsed.success) {
    return NextResponse.json({ error: 'Validation error', details: parsed.error.flatten() }, { status: 400 })
  }

  const db = createServiceRoleClient()

  // Get the connected account
  const { data: account } = await db
    .from('instagram_accounts')
    .select('id')
    .eq('is_connected', true)
    .single()

  if (!account) return NextResponse.json({ error: 'No connected Instagram account' }, { status: 400 })

  const { data, error } = await db
    .from('automations')
    .insert({
      name: parsed.data.name,
      instagram_account_id: account.id,
      media_id: parsed.data.mediaId ?? null,
      keyword: parsed.data.keyword,
      match_type: parsed.data.matchType,
      dm_message: parsed.data.dmMessage,
      button_text: parsed.data.buttonText ?? null,
      button_url: parsed.data.buttonUrl ?? null,
      is_active: parsed.data.isActive,
    })
    .select()
    .single()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  return NextResponse.json({ automation: data }, { status: 201 })
}
