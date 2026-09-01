/**
 * lib/automation/executor.ts
 *
 * Automation executor — orchestrates the full pipeline:
 *   1. Look up the active Instagram account
 *   2. Decrypt the access token
 *   3. Load active automations
 *   4. Match the comment against automations
 *   5. Check for duplicate execution (same comment + automation)
 *   6. Send the private reply
 *   7. Record the execution result
 *
 * Called from the webhook route handler asynchronously (after 200 response).
 * All errors are caught and recorded — they do not crash the server.
 *
 * NEVER expose access tokens. This module is server-side only.
 */

import { createServiceRoleClient } from '@/lib/supabase/server'
import { decrypt } from '@/lib/security/encryption'
import { sendPrivateReply } from '@/lib/meta/messages'
import { matchAutomation, type Automation } from '@/lib/automation/matcher'
import { webhookLogger, type CommentChangeValue } from '@/lib/meta/webhooks'

export interface ProcessCommentParams {
  webhookEventId: string
  /** The entry.id from the webhook — this is the Instagram User ID of the account that received the comment */
  igAccountId: string
  commentId: string
  commentText: string
  mediaId: string
  commenterId?: string | null
}

/**
 * Processes a comment event end-to-end.
 * This is the main entry point called by the webhook route.
 *
 * Returns a summary of what happened (for logging).
 */
export async function processComment(params: ProcessCommentParams): Promise<{
  matched: boolean
  automationId?: string
  status: 'sent' | 'failed' | 'skipped' | 'no_match' | 'no_account'
  error?: string
}> {
  const { webhookEventId, igAccountId, commentId, commentText, mediaId, commenterId } = params

  const db = createServiceRoleClient()

  // =============================================
  // 1. Find the Instagram account
  // =============================================
  const { data: account, error: accountError } = await db
    .from('instagram_accounts')
    .select('id, access_token_encrypted, is_connected')
    .eq('instagram_user_id', igAccountId)
    .single()

  if (accountError || !account) {
    webhookLogger.error(commentId, `No account found for ig_user_id=${igAccountId}`)
    return { matched: false, status: 'no_account', error: 'Account not found' }
  }

  if (!account.is_connected) {
    webhookLogger.error(commentId, `Account ${igAccountId} is disconnected`)
    return { matched: false, status: 'no_account', error: 'Account disconnected' }
  }

  // =============================================
  // 2. Decrypt the access token
  // =============================================
  let accessToken: string
  try {
    accessToken = decrypt(account.access_token_encrypted)
  } catch (err) {
    const error = err instanceof Error ? err.message : 'Token decryption failed'
    webhookLogger.error(commentId, error)
    return { matched: false, status: 'failed', error }
  }

  // =============================================
  // 3. Load active automations for this account
  // =============================================
  const { data: automations, error: automationsError } = await db
    .from('automations')
    .select('*')
    .eq('instagram_account_id', account.id)
    .eq('is_active', true)

  if (automationsError) {
    const error = `Failed to load automations: ${automationsError.message}`
    webhookLogger.error(commentId, error)
    return { matched: false, status: 'failed', error }
  }

  if (!automations || automations.length === 0) {
    return { matched: false, status: 'no_match' }
  }

  // =============================================
  // 4. Match the comment against automations
  // =============================================
  const matched = matchAutomation(
    { commentText, mediaId },
    automations as Automation[]
  )

  if (!matched) {
    webhookLogger.dm(commentId, 'skipped', 'No matching automation')
    return { matched: false, status: 'no_match' }
  }

  webhookLogger.match(matched.id, matched.keyword, true)

  // =============================================
  // 5. Check for duplicate execution
  //    The DB UNIQUE constraint (automation_id, instagram_comment_id)
  //    is the final guard, but we check first to avoid unnecessary API calls.
  // =============================================
  const { data: existing } = await db
    .from('automation_executions')
    .select('id, status')
    .eq('automation_id', matched.id)
    .eq('instagram_comment_id', commentId)
    .maybeSingle()

  if (existing) {
    webhookLogger.dm(commentId, 'skipped', `Duplicate: already ${existing.status}`)
    return {
      matched: true,
      automationId: matched.id,
      status: 'skipped',
      error: `Already processed with status: ${existing.status}`,
    }
  }

  // =============================================
  // 6. Send the private reply
  // =============================================
  webhookLogger.dm(commentId, 'sent')

  const result = await sendPrivateReply({
    igUserId: igAccountId,
    commentId,
    message: matched.dm_message,
    buttonText: matched.button_text,
    buttonUrl: matched.button_url,
    accessToken,
  })

  // =============================================
  // 7. Record the execution result
  // =============================================
  const executionStatus = result.success ? 'sent' : 'failed'

  // Use upsert to gracefully handle the rare race condition where
  // another webhook delivery inserted the row between our check and now.
  await db.from('automation_executions').upsert(
    {
      automation_id: matched.id,
      webhook_event_id: webhookEventId,
      instagram_comment_id: commentId,
      instagram_user_id: commenterId ?? null,
      status: executionStatus,
      error: result.error ?? null,
    },
    {
      onConflict: 'automation_id,instagram_comment_id',
      ignoreDuplicates: true,
    }
  )

  if (result.success) {
    webhookLogger.dm(commentId, 'sent')
    return { matched: true, automationId: matched.id, status: 'sent' }
  } else {
    webhookLogger.dm(commentId, 'failed', result.error)
    return { matched: true, automationId: matched.id, status: 'failed', error: result.error }
  }
}

/**
 * Parses the comment change value from a webhook payload and extracts
 * the fields needed by processComment().
 */
export function extractCommentFields(value: CommentChangeValue): {
  commentId: string
  commentText: string
  mediaId: string
  commenterId?: string
} | null {
  if (!value?.id || !value?.text || !value?.media?.id) {
    return null
  }

  return {
    commentId: value.id,
    commentText: value.text,
    mediaId: value.media.id,
    commenterId: value.from?.id,
  }
}
