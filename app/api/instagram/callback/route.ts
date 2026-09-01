/**
 * app/api/instagram/callback/route.ts
 *
 * Meta OAuth Callback Handler
 *
 * After the user authorizes the app on Meta, they are redirected here with:
 *   ?code=<authorization_code>&state=<csrf_state>
 *
 * This route:
 *   1. Validates the CSRF state cookie
 *   2. Exchanges the code for a short-lived token
 *   3. Exchanges for a long-lived token (~60 days)
 *   4. Gets the Instagram account info
 *   5. Gets the connected Facebook Page info
 *   6. Stores the encrypted tokens and account info in the database
 *   7. Redirects to the dashboard
 *
 * The APP_SECRET is never exposed to the browser.
 * Tokens are encrypted before storage using AES-256-GCM.
 */

import { NextRequest, NextResponse } from 'next/server'
import { createServerClient, createServiceRoleClient } from '@/lib/supabase/server'
import {
  exchangeCodeForToken,
  getLongLivedToken,
  getInstagramAccount,
  getFacebookPages,
  getInstagramAccountFromPage,
} from '@/lib/meta/instagram'
import { encrypt } from '@/lib/security/encryption'

export async function GET(request: NextRequest) {
  const appUrl = process.env.NEXT_PUBLIC_APP_URL ?? 'http://localhost:3000'
  const { searchParams } = new URL(request.url)

  const code = searchParams.get('code')
  const state = searchParams.get('state')
  const error = searchParams.get('error')
  const errorDescription = searchParams.get('error_description')

  // Handle user denial
  if (error) {
    console.warn(`[OAuth] User denied authorization: ${errorDescription}`)
    return NextResponse.redirect(
      `${appUrl}/settings?error=${encodeURIComponent(errorDescription ?? error)}`
    )
  }

  if (!code) {
    return NextResponse.redirect(`${appUrl}/settings?error=missing_code`)
  }

  // CSRF state validation
  const cookieState = request.cookies.get('oauth_state')?.value
  if (!state || state !== cookieState) {
    console.warn('[OAuth] CSRF state mismatch')
    return NextResponse.redirect(`${appUrl}/settings?error=invalid_state`)
  }

  // Ensure user is authenticated
  const supabase = await createServerClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) {
    return NextResponse.redirect(`${appUrl}/login`)
  }

  try {
    // Exchange code for short-lived token
    const shortLivedTokenData = await exchangeCodeForToken(code)
    const shortLivedToken = shortLivedTokenData.access_token

    // Exchange for long-lived token (~60 days)
    const longLivedTokenData = await getLongLivedToken(shortLivedToken)
    const longLivedToken = longLivedTokenData.access_token
    const expiresIn = longLivedTokenData.expires_in

    // Calculate expiry timestamp
    const tokenExpiresAt = expiresIn
      ? new Date(Date.now() + expiresIn * 1000).toISOString()
      : null

    // Get Instagram account info
    const igAccount = await getInstagramAccount(longLivedToken)

    // Get Facebook Pages to obtain page access token
    const pages = await getFacebookPages(longLivedToken)
    let pageId: string | null = null
    let pageAccessToken: string | null = null
    let pageEncryptedToken: string | null = null

    if (pages.length > 0) {
      // Use the first page (most personal accounts have one)
      const page = pages[0]
      pageId = page.id
      pageAccessToken = page.access_token

      // Verify Instagram account is connected to this page
      if (pageAccessToken) {
        const igFromPage = await getInstagramAccountFromPage(page.id, pageAccessToken)
        if (igFromPage && igFromPage.id === igAccount.id) {
          pageEncryptedToken = encrypt(pageAccessToken)
        }
      }
    }

    // Encrypt the access token before storing
    const encryptedToken = encrypt(longLivedToken)

    // Store in database (upsert — handles reconnection)
    const db = createServiceRoleClient()
    const { error: dbError } = await db.from('instagram_accounts').upsert(
      {
        instagram_user_id: igAccount.id,
        username: igAccount.username,
        access_token_encrypted: encryptedToken,
        page_id: pageId,
        page_access_token_encrypted: pageEncryptedToken,
        token_expires_at: tokenExpiresAt,
        is_connected: true,
        updated_at: new Date().toISOString(),
      },
      { onConflict: 'instagram_user_id' }
    )

    if (dbError) {
      console.error('[OAuth] Failed to save account:', dbError.message)
      return NextResponse.redirect(
        `${appUrl}/settings?error=${encodeURIComponent('Failed to save account. Check server logs.')}`
      )
    }

    console.log(`[OAuth] Successfully connected @${igAccount.username}`)

    // Clear the state cookie and redirect to dashboard
    const response = NextResponse.redirect(`${appUrl}/dashboard?connected=true`)
    response.cookies.delete('oauth_state')
    return response

  } catch (err) {
    const error = err instanceof Error ? err.message : 'OAuth failed'
    console.error('[OAuth] Error:', error)
    return NextResponse.redirect(
      `${appUrl}/settings?error=${encodeURIComponent(error)}`
    )
  }
}
