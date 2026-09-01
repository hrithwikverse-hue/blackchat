/**
 * app/api/webhooks/instagram/route.ts
 *
 * Meta Instagram Webhook Endpoint
 *
 * GET  → Webhook verification handshake (Meta calls this when you set up the webhook)
 * POST → Receives real-time webhook events (comments, messages, etc.)
 *
 * IMPORTANT:
 * - Return HTTP 200 quickly. Do NOT do long-running work before responding.
 * - Signature verification is mandatory. Reject unsigned requests (403).
 * - Idempotency: duplicate events are silently ignored via DB unique constraint.
 * - Processing happens asynchronously after the 200 response is sent.
 *
 * Setup in Meta Developer Dashboard:
 *   Callback URL: https://your-tunnel.example.com/api/webhooks/instagram
 *   Verify Token: (value of META_VERIFY_TOKEN env variable)
 *   Subscribe to: comments, live_comments, messages
 */

import { NextRequest, NextResponse } from 'next/server'
import {
  verifyWebhookSignature,
  parseWebhookPayload,
  generateEventId,
  webhookLogger,
  type CommentChangeValue,
} from '@/lib/meta/webhooks'
import { createServiceRoleClient } from '@/lib/supabase/server'
import { processComment, extractCommentFields } from '@/lib/automation/executor'

// =============================================
// GET — Webhook Verification
// =============================================

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url)

  const mode = searchParams.get('hub.mode')
  const token = searchParams.get('hub.verify_token')
  const challenge = searchParams.get('hub.challenge')

  if (mode !== 'subscribe') {
    return new NextResponse('Invalid mode', { status: 400 })
  }

  const expectedToken = process.env.META_VERIFY_TOKEN
  if (!expectedToken) {
    console.error('[WEBHOOK] META_VERIFY_TOKEN is not set')
    return new NextResponse('Server configuration error', { status: 500 })
  }

  if (token !== expectedToken) {
    console.warn('[WEBHOOK] Verification failed: token mismatch')
    return new NextResponse('Forbidden', { status: 403 })
  }

  console.log('[WEBHOOK] Verification successful')
  return new NextResponse(challenge, { status: 200 })
}

// =============================================
// POST — Webhook Event Processing
// =============================================

export async function POST(request: NextRequest) {
  // Read raw body for signature verification
  let rawBody: Buffer
  try {
    rawBody = Buffer.from(await request.arrayBuffer())
  } catch {
    return new NextResponse('Bad request', { status: 400 })
  }

  // Verify HMAC-SHA256 signature
  const signatureHeader = request.headers.get('x-hub-signature-256')
  if (!verifyWebhookSignature(rawBody, signatureHeader)) {
    console.warn('[WEBHOOK] Signature verification failed')
    return new NextResponse('Forbidden', { status: 403 })
  }

  // Parse the payload
  let body: unknown
  try {
    body = JSON.parse(rawBody.toString('utf8'))
  } catch {
    return new NextResponse('Invalid JSON', { status: 400 })
  }

  const payload = parseWebhookPayload(body)
  if (!payload) {
    // Not an Instagram webhook — return 200 to avoid Meta retries
    return new NextResponse('OK', { status: 200 })
  }

  // =============================================
  // Return 200 IMMEDIATELY — Meta expects a fast response.
  // Processing happens asynchronously below.
  // =============================================
  const response = new NextResponse('OK', { status: 200 })

  // Process asynchronously (fire and forget)
  // setImmediate ensures the response is flushed before heavy work starts
  setImmediate(async () => {
    try {
      await processWebhookPayload(payload, rawBody)
    } catch (err) {
      const error = err instanceof Error ? err.message : 'Unknown error'
      console.error(`[WEBHOOK] Unhandled error during async processing: ${error}`)
    }
  })

  return response
}

// =============================================
// Internal: Process the webhook payload
// =============================================

async function processWebhookPayload(
  payload: ReturnType<typeof parseWebhookPayload>,
  _rawBody: Buffer
) {
  if (!payload) return

  const db = createServiceRoleClient()

  for (const entry of payload.entry) {
    for (const change of entry.changes) {
      // Only process comment events
      if (change.field !== 'comments' && change.field !== 'live_comments') {
        continue
      }

      const eventId = generateEventId(entry, change)
      webhookLogger.received(eventId, change.field)

      // ==========================================
      // Idempotency check + store
      // Insert returns nothing if event_id already exists (ON CONFLICT DO NOTHING)
      // ==========================================
      const { data: insertedEvent, error: insertError } = await db
        .from('webhook_events')
        .insert({
          event_id: eventId,
          event_type: change.field,
          payload: change.value,
          status: 'received',
        })
        .select('id')
        .single()

      if (insertError) {
        // Unique constraint violation = duplicate event
        if (insertError.code === '23505') {
          webhookLogger.duplicate(eventId)
          continue
        }
        webhookLogger.error(eventId, `DB insert error: ${insertError.message}`)
        continue
      }

      const webhookEventId = insertedEvent?.id
      if (!webhookEventId) {
        webhookLogger.error(eventId, 'No event ID returned after insert')
        continue
      }

      // Mark as processing
      await db
        .from('webhook_events')
        .update({ status: 'processing' })
        .eq('id', webhookEventId)

      webhookLogger.processing(eventId)

      // Extract comment fields
      const commentFields = extractCommentFields(change.value as CommentChangeValue)
      if (!commentFields) {
        await db
          .from('webhook_events')
          .update({ status: 'skipped', processed_at: new Date().toISOString() })
          .eq('id', webhookEventId)
        continue
      }

      // Process the comment
      try {
        const result = await processComment({
          webhookEventId,
          igAccountId: entry.id,
          ...commentFields,
        })

        const finalStatus = result.status === 'sent'
          ? 'processed'
          : result.status === 'no_match' || result.status === 'skipped'
          ? 'skipped'
          : 'failed'

        await db
          .from('webhook_events')
          .update({
            status: finalStatus,
            error: result.error ?? null,
            processed_at: new Date().toISOString(),
          })
          .eq('id', webhookEventId)

        webhookLogger.processed(eventId)
      } catch (err) {
        const error = err instanceof Error ? err.message : 'Unknown error'
        webhookLogger.error(eventId, error)
        await db
          .from('webhook_events')
          .update({
            status: 'failed',
            error,
            processed_at: new Date().toISOString(),
          })
          .eq('id', webhookEventId)
      }
    }
  }
}
