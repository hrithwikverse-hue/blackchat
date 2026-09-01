/**
 * lib/meta/webhooks.ts
 *
 * Meta Webhook utilities:
 *  - HMAC-SHA256 signature verification
 *  - Webhook payload type definitions
 *  - Event ID generation for idempotency
 *
 * Meta signs webhook POST requests with:
 *   X-Hub-Signature-256: sha256=<hmac>
 *
 * The secret used is the META_APP_SECRET.
 * We MUST verify this before processing any payload.
 */

import { createHmac, timingSafeEqual } from 'crypto'

// =============================================
// Signature Verification
// =============================================

/**
 * Verifies the HMAC-SHA256 signature on a Meta webhook request.
 *
 * @param rawBody - The raw request body as a Buffer or string
 * @param signatureHeader - The value of X-Hub-Signature-256 header
 * @returns true if the signature is valid
 *
 * NOTE: timingSafeEqual prevents timing attacks.
 */
export function verifyWebhookSignature(
  rawBody: Buffer | string,
  signatureHeader: string | null
): boolean {
  if (!signatureHeader) {
    console.warn('[WEBHOOK] Missing X-Hub-Signature-256 header')
    return false
  }

  const appSecret = process.env.META_APP_SECRET
  if (!appSecret) {
    console.error('[WEBHOOK] META_APP_SECRET is not set — cannot verify signature')
    return false
  }

  const expectedSignature = createHmac('sha256', appSecret)
    .update(rawBody)
    .digest('hex')

  const received = signatureHeader.replace('sha256=', '')

  try {
    const expectedBuffer = Buffer.from(expectedSignature, 'hex')
    const receivedBuffer = Buffer.from(received, 'hex')

    if (expectedBuffer.length !== receivedBuffer.length) {
      return false
    }

    return timingSafeEqual(expectedBuffer, receivedBuffer)
  } catch {
    return false
  }
}

// =============================================
// Webhook Payload Types
// =============================================

/**
 * Top-level Instagram webhook payload structure.
 * Meta sends these for comment, message, and other events.
 */
export interface InstagramWebhookPayload {
  object: 'instagram'
  entry: InstagramWebhookEntry[]
}

export interface InstagramWebhookEntry {
  id: string           // Instagram user ID of the page/account
  time: number         // Unix timestamp
  changes: InstagramWebhookChange[]
  messaging?: InstagramWebhookMessaging[]
}

export interface InstagramWebhookChange {
  field: string        // e.g. 'comments', 'live_comments', 'mentions'
  value: CommentChangeValue | Record<string, unknown>
}

export interface CommentChangeValue {
  id: string           // Comment ID
  text: string         // Comment text
  media: {
    id: string         // Media/post ID the comment was left on
    media_product_type?: string
  }
  from?: {
    id: string         // Commenter's Instagram Scoped User ID
    username?: string
  }
  timestamp?: string
}

export interface InstagramWebhookMessaging {
  sender: { id: string }
  recipient: { id: string }
  timestamp: number
  message?: {
    mid: string
    text: string
  }
}

// =============================================
// Event ID Generation
// =============================================

/**
 * Generates a unique, stable event ID from the webhook payload.
 * This ID is used as the unique key in webhook_events table
 * to ensure idempotency — Meta may retry events.
 *
 * Format: {entry_id}_{field}_{value_id}_{timestamp}
 */
export function generateEventId(
  entry: InstagramWebhookEntry,
  change: InstagramWebhookChange
): string {
  const value = change.value as CommentChangeValue
  const commentId = value?.id ?? 'unknown'
  return `${entry.id}_${change.field}_${commentId}_${entry.time}`
}

/**
 * Parses a raw webhook body into the typed payload.
 * Returns null if the payload is not a valid Instagram webhook.
 */
export function parseWebhookPayload(body: unknown): InstagramWebhookPayload | null {
  if (!body || typeof body !== 'object') return null
  const payload = body as Record<string, unknown>
  if (payload.object !== 'instagram') return null
  if (!Array.isArray(payload.entry)) return null
  return payload as unknown as InstagramWebhookPayload
}

// =============================================
// Structured Logging
// =============================================

/**
 * Structured server-side logger for webhook events.
 * Does NOT log access tokens, secrets, or sensitive personal data.
 */
export const webhookLogger = {
  received: (eventId: string, type: string) => {
    console.log(`[WEBHOOK] event_id=${eventId} type=${type} status=received`)
  },
  duplicate: (eventId: string) => {
    console.log(`[WEBHOOK] event_id=${eventId} status=duplicate_skipped`)
  },
  processing: (eventId: string) => {
    console.log(`[WEBHOOK] event_id=${eventId} status=processing`)
  },
  processed: (eventId: string) => {
    console.log(`[WEBHOOK] event_id=${eventId} status=processed`)
  },
  error: (eventId: string, error: string) => {
    console.error(`[WEBHOOK] event_id=${eventId} status=error error="${error}"`)
  },
  match: (automationId: string, keyword: string, matched: boolean) => {
    console.log(`[MATCH] automation_id=${automationId} keyword=${keyword} matched=${matched}`)
  },
  dm: (commentId: string, status: 'sent' | 'success' | 'failed' | 'skipped', error?: string) => {
    const msg = `[DM] comment_id=${commentId} status=${status}`
    if (error) {
      console.error(`${msg} error="${error}"`)
    } else {
      console.log(msg)
    }
  },
}
