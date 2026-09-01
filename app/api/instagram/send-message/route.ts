/**
 * app/api/instagram/send-message/route.ts
 *
 * Test endpoint for sending a private reply manually.
 * For use in the Settings > Test Mode panel only.
 *
 * This is a TEST tool — it sends a real DM but is clearly labeled as a test.
 * Requires a real comment ID from your Instagram post.
 *
 * Access token is NEVER exposed to the browser.
 * This endpoint requires authentication.
 *
 * NOTE: This sends a REAL private reply via the Meta API.
 * Only use with a comment ID from a test comment you made yourself.
 */

import { NextRequest, NextResponse } from 'next/server'
import { createServerClient, createServiceRoleClient } from '@/lib/supabase/server'
import { sendPrivateReply } from '@/lib/meta/messages'
import { decrypt } from '@/lib/security/encryption'
import { sendTestMessageSchema } from '@/lib/validation/schemas'

export async function POST(request: NextRequest) {
  // Require authentication
  const supabase = await createServerClient()
  const { data: { user } } = await supabase.auth.getUser()

  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  // Validate request body
  let body: unknown
  try {
    body = await request.json()
  } catch {
    return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 })
  }

  const parsed = sendTestMessageSchema.safeParse(body)
  if (!parsed.success) {
    return NextResponse.json(
      { error: 'Validation error', details: parsed.error.flatten() },
      { status: 400 }
    )
  }

  const { commentId, message } = parsed.data

  // Get connected account
  const db = createServiceRoleClient()
  const { data: account, error: accountError } = await db
    .from('instagram_accounts')
    .select('instagram_user_id, access_token_encrypted, username')
    .eq('is_connected', true)
    .single()

  if (accountError || !account) {
    return NextResponse.json({ error: 'No connected Instagram account' }, { status: 404 })
  }

  // Decrypt token
  let accessToken: string
  try {
    accessToken = decrypt(account.access_token_encrypted)
  } catch {
    return NextResponse.json({ error: 'Failed to decrypt access token' }, { status: 500 })
  }

  // Send the private reply
  const result = await sendPrivateReply({
    igUserId: account.instagram_user_id,
    commentId,
    message: `[TEST] ${message}`,
    accessToken,
  })

  if (result.success) {
    return NextResponse.json({
      success: true,
      messageId: result.messageId,
      note: 'This was a real DM sent via the Meta API (prefixed with [TEST])',
    })
  } else {
    return NextResponse.json({ success: false, error: result.error }, { status: 500 })
  }
}
