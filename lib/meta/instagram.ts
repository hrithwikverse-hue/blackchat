/**
 * lib/meta/instagram.ts
 *
 * Meta Instagram Graph API client.
 * Provides functions for reading account info, media, and comments.
 *
 * API version is configurable via META_GRAPH_API_VERSION env variable.
 * Default: v22.0 (stable as of mid-2025; latest is v26.0 as of Sep 2026).
 * Update META_GRAPH_API_VERSION in .env.local to use a newer version.
 *
 * Required permissions:
 *   - instagram_business_basic (read account, media)
 *   - instagram_business_manage_comments (read comments)
 *   - pages_show_list (list pages)
 *
 * All functions throw on error — callers should handle exceptions.
 * NEVER expose access tokens to the browser.
 */

const API_BASE = 'https://graph.facebook.com'

function getApiVersion(): string {
  return process.env.META_GRAPH_API_VERSION ?? 'v22.0'
}

function apiUrl(path: string): string {
  return `${API_BASE}/${getApiVersion()}${path}`
}

// =============================================
// Types
// =============================================

export interface InstagramAccount {
  id: string
  username: string
  name: string
  profile_picture_url?: string
  followers_count?: number
}

export interface InstagramMedia {
  id: string
  media_type: 'IMAGE' | 'VIDEO' | 'CAROUSEL_ALBUM' | 'REELS'
  media_url?: string
  thumbnail_url?: string
  permalink?: string
  caption?: string
  timestamp: string
  shortcode?: string
}

export interface InstagramComment {
  id: string
  text: string
  timestamp: string
  username?: string
  from?: { id: string; username: string }
}

export interface MetaApiError {
  error: {
    message: string
    type: string
    code: number
    fbtrace_id: string
  }
}

// =============================================
// Account
// =============================================

/**
 * Gets the Instagram Business/Creator account details.
 * Requires instagram_business_basic permission.
 *
 * @param accessToken - A valid Instagram user access token
 */
export async function getInstagramAccount(accessToken: string): Promise<InstagramAccount> {
  const url = apiUrl('/me?fields=id,username,name,profile_picture_url,followers_count')
  const response = await fetch(url, {
    headers: { Authorization: `Bearer ${accessToken}` },
  })

  const data = await response.json()

  if (!response.ok) {
    const err = data as MetaApiError
    throw new Error(`[Meta API] Failed to get account: ${err.error?.message ?? response.statusText}`)
  }

  return data as InstagramAccount
}

/**
 * Gets the list of Instagram Business accounts connected to a Facebook Page.
 * Used during OAuth callback to get the Instagram user ID.
 *
 * @param pageId - Facebook Page ID
 * @param pageAccessToken - Page access token
 */
export async function getInstagramAccountFromPage(
  pageId: string,
  pageAccessToken: string
): Promise<InstagramAccount | null> {
  const url = apiUrl(`/${pageId}?fields=instagram_business_account{id,username,name,profile_picture_url,followers_count}`)
  const response = await fetch(url, {
    headers: { Authorization: `Bearer ${pageAccessToken}` },
  })

  const data = await response.json()

  if (!response.ok) {
    const err = data as MetaApiError
    throw new Error(`[Meta API] Failed to get IG account from page: ${err.error?.message ?? response.statusText}`)
  }

  return data.instagram_business_account ?? null
}

// =============================================
// Media
// =============================================

/**
 * Gets the user's Instagram media (posts and reels).
 * Returns up to 25 most recent items.
 * Requires instagram_business_basic permission.
 *
 * @param igUserId - Instagram user ID (from account.id)
 * @param accessToken - Valid Instagram user access token
 * @param limit - Number of items to fetch (max 25)
 */
export async function getInstagramMedia(
  igUserId: string,
  accessToken: string,
  limit = 25
): Promise<InstagramMedia[]> {
  const fields = 'id,media_type,media_url,thumbnail_url,permalink,caption,timestamp,shortcode'
  const url = apiUrl(`/${igUserId}/media?fields=${fields}&limit=${limit}`)
  const response = await fetch(url, {
    headers: { Authorization: `Bearer ${accessToken}` },
  })

  const data = await response.json()

  if (!response.ok) {
    const err = data as MetaApiError
    throw new Error(`[Meta API] Failed to get media: ${err.error?.message ?? response.statusText}`)
  }

  return data.data ?? []
}

/**
 * Gets a single media item by ID.
 *
 * @param mediaId - Instagram media ID
 * @param accessToken - Valid access token
 */
export async function getMediaById(
  mediaId: string,
  accessToken: string
): Promise<InstagramMedia | null> {
  const fields = 'id,media_type,media_url,thumbnail_url,permalink,caption,timestamp,shortcode'
  const url = apiUrl(`/${mediaId}?fields=${fields}`)
  const response = await fetch(url, {
    headers: { Authorization: `Bearer ${accessToken}` },
  })

  const data = await response.json()

  if (!response.ok) {
    if (response.status === 404) return null
    const err = data as MetaApiError
    throw new Error(`[Meta API] Failed to get media ${mediaId}: ${err.error?.message ?? response.statusText}`)
  }

  return data as InstagramMedia
}

// =============================================
// Comments
// =============================================

/**
 * Gets comments for a specific media item.
 * Requires instagram_business_manage_comments permission.
 *
 * @param mediaId - Instagram media ID
 * @param accessToken - Valid access token
 */
export async function getMediaComments(
  mediaId: string,
  accessToken: string
): Promise<InstagramComment[]> {
  const url = apiUrl(`/${mediaId}/comments?fields=id,text,timestamp,username,from&limit=50`)
  const response = await fetch(url, {
    headers: { Authorization: `Bearer ${accessToken}` },
  })

  const data = await response.json()

  if (!response.ok) {
    const err = data as MetaApiError
    throw new Error(`[Meta API] Failed to get comments: ${err.error?.message ?? response.statusText}`)
  }

  return data.data ?? []
}

// =============================================
// Facebook Pages (needed for private reply endpoint)
// =============================================

export interface FacebookPage {
  id: string
  name: string
  access_token: string
}

/**
 * Gets the list of Facebook Pages the user manages.
 * Required to get page access tokens for the /messages endpoint.
 * Requires pages_show_list permission.
 *
 * @param userAccessToken - Facebook user access token
 */
export async function getFacebookPages(userAccessToken: string): Promise<FacebookPage[]> {
  const url = apiUrl('/me/accounts?fields=id,name,access_token')
  const response = await fetch(url, {
    headers: { Authorization: `Bearer ${userAccessToken}` },
  })

  const data = await response.json()

  if (!response.ok) {
    const err = data as MetaApiError
    throw new Error(`[Meta API] Failed to get pages: ${err.error?.message ?? response.statusText}`)
  }

  return data.data ?? []
}

// =============================================
// Token Management
// =============================================

/**
 * Exchanges a short-lived code for a long-lived user access token.
 * Long-lived tokens are valid for ~60 days.
 * This must be done server-side to protect APP_SECRET.
 *
 * @param code - Authorization code from OAuth callback
 */
export async function exchangeCodeForToken(code: string): Promise<{
  access_token: string
  token_type: string
  expires_in?: number
}> {
  const params = new URLSearchParams({
    client_id: process.env.META_APP_ID!,
    client_secret: process.env.META_APP_SECRET!,
    redirect_uri: process.env.META_REDIRECT_URI!,
    code,
  })

  const url = apiUrl(`/oauth/access_token?${params}`)
  const response = await fetch(url, { method: 'GET' })

  const data = await response.json()

  if (!response.ok || data.error) {
    throw new Error(`[Meta API] Token exchange failed: ${data.error?.message ?? 'Unknown error'}`)
  }

  return data
}

/**
 * Exchanges a short-lived token for a long-lived token (60 days).
 * This should be called after the initial OAuth exchange.
 *
 * @param shortLivedToken - Token from exchangeCodeForToken
 */
export async function getLongLivedToken(shortLivedToken: string): Promise<{
  access_token: string
  token_type: string
  expires_in: number
}> {
  const params = new URLSearchParams({
    grant_type: 'fb_exchange_token',
    client_id: process.env.META_APP_ID!,
    client_secret: process.env.META_APP_SECRET!,
    fb_exchange_token: shortLivedToken,
  })

  const url = apiUrl(`/oauth/access_token?${params}`)
  const response = await fetch(url, { method: 'GET' })

  const data = await response.json()

  if (!response.ok || data.error) {
    throw new Error(`[Meta API] Long-lived token exchange failed: ${data.error?.message ?? 'Unknown error'}`)
  }

  return data
}

/**
 * Verifies an access token is still valid.
 * Returns false if the token is expired or invalid.
 *
 * @param accessToken - Token to verify
 */
export async function verifyToken(accessToken: string): Promise<boolean> {
  try {
    const url = apiUrl('/me?fields=id')
    const response = await fetch(url, {
      headers: { Authorization: `Bearer ${accessToken}` },
    })
    return response.ok
  } catch {
    return false
  }
}
