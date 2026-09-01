/**
 * app/api/automations/[id]/route.ts
 * GET    → get single automation
 * PATCH  → update automation
 * DELETE → delete automation
 */

import { NextRequest, NextResponse } from 'next/server'
import { createServerClient, createServiceRoleClient } from '@/lib/supabase/server'
import { updateAutomationSchema } from '@/lib/validation/schemas'

type Params = { params: Promise<{ id: string }> }

export async function GET(_request: NextRequest, { params }: Params) {
  const { id } = await params
  const supabase = await createServerClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const db = createServiceRoleClient()
  const { data, error } = await db
    .from('automations')
    .select(`*, automation_executions(*)`)
    .eq('id', id)
    .single()

  if (error || !data) return NextResponse.json({ error: 'Not found' }, { status: 404 })
  return NextResponse.json({ automation: data })
}

export async function PATCH(request: NextRequest, { params }: Params) {
  const { id } = await params
  const supabase = await createServerClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  let body: unknown
  try { body = await request.json() } catch { return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 }) }

  const parsed = updateAutomationSchema.safeParse(body)
  if (!parsed.success) {
    return NextResponse.json({ error: 'Validation error', details: parsed.error.flatten() }, { status: 400 })
  }

  const updateData: Record<string, unknown> = { updated_at: new Date().toISOString() }
  if (parsed.data.name !== undefined) updateData.name = parsed.data.name
  if (parsed.data.mediaId !== undefined) updateData.media_id = parsed.data.mediaId
  if (parsed.data.keyword !== undefined) updateData.keyword = parsed.data.keyword
  if (parsed.data.matchType !== undefined) updateData.match_type = parsed.data.matchType
  if (parsed.data.dmMessage !== undefined) updateData.dm_message = parsed.data.dmMessage
  if (parsed.data.buttonText !== undefined) updateData.button_text = parsed.data.buttonText
  if (parsed.data.buttonUrl !== undefined) updateData.button_url = parsed.data.buttonUrl
  if (parsed.data.isActive !== undefined) updateData.is_active = parsed.data.isActive

  const db = createServiceRoleClient()
  const { data, error } = await db
    .from('automations')
    .update(updateData)
    .eq('id', id)
    .select()
    .single()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ automation: data })
}

export async function DELETE(_request: NextRequest, { params }: Params) {
  const { id } = await params
  const supabase = await createServerClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const db = createServiceRoleClient()
  const { error } = await db.from('automations').delete().eq('id', id)

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ success: true })
}
