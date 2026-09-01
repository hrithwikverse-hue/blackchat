/**
 * app/api/instagram/posts/route.ts
 *
 * Returns the connected Instagram account's recent media (posts and reels).
 * Used by the automation creation wizard's media picker step.
 *
 * The access token is decrypted server-side and used to call the Meta API.
 * The token is NEVER sent to the browser.
 *
 * Returns a sanitized list of media items safe for the frontend.
 */

import { NextResponse } from 'next/server'
import { createServerClient, createServiceRoleClient } from '@/lib/supabase/server'
import { getInstagramMedia } from '@/lib/meta/instagram'
import { decrypt } from '@/lib/security/encryption'

export async function GET() {
  // Require authentication
  const supabase = await createServerClient()
  const { data: { user } } = await supabase.auth.getUser()

  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  // Get connected account
  const db = createServiceRoleClient()
  const { data: account, error: accountError } = await db
    .from('instagram_accounts')
    .select('instagram_user_id, access_token_encrypted, is_connected, username, token_expires_at')
    .eq('is_connected', true)
    .single()

  if (accountError || !account) {
    return NextResponse.json({ error: 'No connected Instagram account' }, { status: 404 })
  }

  // Check token expiry
  if (account.token_expires_at && new Date(account.token_expires_at) < new Date()) {
    // Mark as disconnected
    await db
      .from('instagram_accounts')
      .update({ is_connected: false })
      .eq('instagram_user_id', account.instagram_user_id)
    return NextResponse.json({ error: 'Instagram token expired. Please reconnect.' }, { status: 401 })
  }

  // Decrypt token (server-side only)
  let accessToken: string
  try {
    accessToken = decrypt(account.access_token_encrypted)
  } catch {
    return NextResponse.json({ error: 'Failed to decrypt access token' }, { status: 500 })
  }

  // Fetch media from Meta API
  try {
    const media = await getInstagramMedia(account.instagram_user_id, accessToken, 25)
    return NextResponse.json({ media, account: { username: account.username } })
  } catch (err) {
    const error = err instanceof Error ? err.message : 'Failed to fetch media'
    console.error('[API/posts]', error)

    // Check if it's a token error
    if (error.includes('token') || error.includes('OAuthException')) {
      await db
        .from('instagram_accounts')
        .update({ is_connected: false })
        .eq('instagram_user_id', account.instagram_user_id)
      return NextResponse.json({ error: 'Instagram token invalid. Please reconnect.' }, { status: 401 })
    }

    return NextResponse.json({ error }, { status: 500 })
  }
}
