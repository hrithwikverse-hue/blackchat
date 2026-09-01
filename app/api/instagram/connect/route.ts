/**
 * app/api/instagram/connect/route.ts
 *
 * Initiates the Meta OAuth flow for Instagram.
 * Redirects the user to Meta's OAuth authorization URL.
 *
 * Required permissions requested:
 *   - instagram_business_basic       → read account info, media
 *   - instagram_business_manage_comments → read comments, webhook subscriptions
 *   - instagram_business_manage_messages → send private replies to commenters
 *   - pages_show_list                → list connected Facebook Pages
 *   - pages_read_engagement          → needed for page-level access
 *
 * NOTE: Meta's App Review is required for instagram_business_manage_messages
 * to work in Live mode. During development, add your account as a Test User
 * in the Meta App Dashboard under Roles > Test Users.
 */

import { NextResponse } from 'next/server'
import { createServerClient } from '@/lib/supabase/server'

// Permissions required for this app's functionality.
// Do not add permissions you don't need — Meta reviews these.
const REQUIRED_PERMISSIONS = [
  'instagram_business_basic',           // Read account info, media list
  'instagram_business_manage_comments', // Read comments, receive comment webhooks
  'instagram_business_manage_messages', // Send private replies (requires App Review for Live mode)
  'pages_show_list',                    // List connected Facebook Pages (needed for /messages endpoint)
  'pages_read_engagement',              // Read page engagement data
].join(',')

export async function GET() {
  // Ensure the user is authenticated before initiating OAuth
  const supabase = await createServerClient()
  const { data: { user } } = await supabase.auth.getUser()

  if (!user) {
    return NextResponse.redirect(new URL('/login', process.env.NEXT_PUBLIC_APP_URL!))
  }

  const appId = process.env.META_APP_ID
  const redirectUri = process.env.META_REDIRECT_URI

  if (!appId || !redirectUri) {
    return NextResponse.json(
      { error: 'META_APP_ID and META_REDIRECT_URI must be set in .env.local' },
      { status: 500 }
    )
  }

  const state = generateState()

  // Build Meta OAuth URL
  const oauthUrl = new URL('https://www.facebook.com/dialog/oauth')
  oauthUrl.searchParams.set('client_id', appId)
  oauthUrl.searchParams.set('redirect_uri', redirectUri)
  oauthUrl.searchParams.set('scope', REQUIRED_PERMISSIONS)
  oauthUrl.searchParams.set('response_type', 'code')
  oauthUrl.searchParams.set('state', state)

  const response = NextResponse.redirect(oauthUrl.toString())

  // Store state in cookie for CSRF protection
  response.cookies.set('oauth_state', state, {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    maxAge: 60 * 10, // 10 minutes
    path: '/',
  })

  return response
}

function generateState(): string {
  const array = new Uint8Array(16)
  if (typeof crypto !== 'undefined' && crypto.getRandomValues) {
    crypto.getRandomValues(array)
  } else {
    // Node.js fallback
    const { randomBytes } = require('crypto')
    const buf = randomBytes(16)
    array.set(buf)
  }
  return Array.from(array, (b) => b.toString(16).padStart(2, '0')).join('')
}
