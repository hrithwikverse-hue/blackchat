/**
 * app/api/stats/route.ts
 * Returns dashboard statistics.
 */

import { NextResponse } from 'next/server'
import { createServerClient, createServiceRoleClient } from '@/lib/supabase/server'

export async function GET() {
  const supabase = await createServerClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const db = createServiceRoleClient()

  const [automationsResult, executionsResult, accountResult] = await Promise.all([
    db.from('automations').select('id, is_active, name'),
    db.from('automation_executions').select('id, status, created_at, automation_id, instagram_comment_id'),
    db.from('instagram_accounts').select('username, is_connected, token_expires_at').eq('is_connected', true).maybeSingle(),
  ])

  const automations = automationsResult.data ?? []
  const executions = executionsResult.data ?? []
  const account = accountResult.data

  const totalAutomations = automations.length
  const activeAutomations = automations.filter((a) => a.is_active).length
  const dmsSent = executions.filter((e) => e.status === 'sent').length
  const dmsFailed = executions.filter((e) => e.status === 'failed').length

  // Recent activity (last 20 executions with automation names)
  const recentExecutions = executions
    .sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime())
    .slice(0, 20)
    .map((e) => ({
      ...e,
      automation_name: automations.find((a) => a.id === e.automation_id)?.name ?? 'Unknown',
    }))

  return NextResponse.json({
    totalAutomations,
    activeAutomations,
    commentsProcessed: executions.length,
    dmsSent,
    dmsFailed,
    recentExecutions,
    account,
  })
}
