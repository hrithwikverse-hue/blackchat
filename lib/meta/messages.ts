/**
 * lib/meta/messages.ts
 *
 * Meta Instagram Graph API — Private Reply / Messaging
 *
 * IMPORTANT: Instagram does NOT support sending arbitrary DMs.
 * What IS supported:
 *   - Private Reply: Responding to a specific comment via DM.
 *     Uses the /{ig-user-id}/messages endpoint with comment_id as recipient.
 *     Requires: instagram_business_manage_messages permission.
 *     Limitations:
 *       - One private reply per comment
 *       - Must be sent within 7 days of the comment
 *       - After user replies, a 24-hour messaging window opens
 *
 * The "button" concept from the UI becomes a plain-text URL appended
 * to the message, since Instagram DMs only support plain text via the API.
 *
 * Button format:
 *   "<message>\n\n<buttonText>: <buttonUrl>"
 *
 * NEVER import this in client-side code. Access tokens must stay server-side.
 *
 * API Version: configurable via META_GRAPH_API_VERSION env variable.
 */

const API_BASE = 'https://graph.facebook.com'

function getApiVersion(): string {
  return process.env.META_GRAPH_API_VERSION ?? 'v22.0'
}

// =============================================
// Types
// =============================================

export interface PrivateReplyParams {
  /** The Instagram user ID of the account sending the reply */
  igUserId: string
  /** The comment ID to reply to (from the webhook payload) */
  commentId: string
  /** Plain text message to send */
  message: string
  /** Optional button text (appended as "buttonText: buttonUrl") */
  buttonText?: string | null
  /** Optional HTTPS URL for the button (appended to message) */
  buttonUrl?: string | null
  /** The access token for the Instagram account */
  accessToken: string
}

export interface SendMessageResult {
  success: boolean
  messageId?: string
  recipientId?: string
  error?: string
}

// =============================================
// Message building
// =============================================

/**
 * Builds the final message text including the button URL appended as plain text.
 * Instagram DMs do not support rich text, buttons, or markdown via the API.
 */
export function buildMessageText(
  message: string,
  buttonText?: string | null,
  buttonUrl?: string | null
): string {
  let text = message.trim()

  if (buttonUrl) {
    const label = buttonText?.trim() || 'Link'
    text += `\n\n${label}: ${buttonUrl}`
  }

  return text
}

// =============================================
// Private Reply
// =============================================

/**
 * Sends a private reply to an Instagram comment.
 *
 * This uses the official Meta private reply API:
 *   POST /{ig-user-id}/messages
 *   { recipient: { comment_id: "..." }, message: { text: "..." } }
 *
 * Requirements:
 *   - App must have instagram_business_manage_messages permission
 *   - The comment must be < 7 days old
 *   - Each comment can only receive one private reply
 *
 * This function is called only from server-side webhook processing.
 * Tokens are NEVER exposed to the browser.
 */
export async function sendPrivateReply(params: PrivateReplyParams): Promise<SendMessageResult> {
  const { igUserId, commentId, message, buttonText, buttonUrl, accessToken } = params

  const messageText = buildMessageText(message, buttonText, buttonUrl)

  const url = `${API_BASE}/${getApiVersion()}/${igUserId}/messages`

  const body = {
    recipient: {
      comment_id: commentId,
    },
    message: {
      text: messageText,
    },
  }

  let response: Response
  try {
    response = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${accessToken}`,
      },
      body: JSON.stringify(body),
    })
  } catch (err) {
    const errorMsg = err instanceof Error ? err.message : 'Network error'
    return { success: false, error: `Network error: ${errorMsg}` }
  }

  const data = await response.json()

  if (!response.ok) {
    const errorMsg = data.error?.message ?? `HTTP ${response.status}`
    const errorCode = data.error?.code
    const errorSubcode = data.error?.error_subcode

    // Provide helpful context for known error codes
    let helpfulError = `Meta API error: ${errorMsg} (code: ${errorCode})`
    if (errorCode === 10) {
      helpfulError += ' — App may need instagram_business_manage_messages permission (App Review required for Live mode)'
    }
    if (errorSubcode === 2534022) {
      helpfulError += ' — Comment is older than 7 days or outside the messaging window'
    }

    return { success: false, error: helpfulError }
  }

  return {
    success: true,
    messageId: data.message_id,
    recipientId: data.recipient_id,
  }
}

/**
 * Sends a direct message to a user (requires an existing messaging window).
 * This can only be used after the user has first messaged your account,
 * or replied to your private reply (which opens a 24-hour window).
 *
 * For comment-triggered automations, use sendPrivateReply instead.
 */
export async function sendMessage(params: {
  igUserId: string
  recipientId: string
  message: string
  accessToken: string
}): Promise<SendMessageResult> {
  const { igUserId, recipientId, message, accessToken } = params

  const url = `${API_BASE}/${getApiVersion()}/${igUserId}/messages`

  const body = {
    recipient: { id: recipientId },
    message: { text: message },
  }

  let response: Response
  try {
    response = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${accessToken}`,
      },
      body: JSON.stringify(body),
    })
  } catch (err) {
    const errorMsg = err instanceof Error ? err.message : 'Network error'
    return { success: false, error: `Network error: ${errorMsg}` }
  }

  const data = await response.json()

  if (!response.ok) {
    return { success: false, error: `Meta API error: ${data.error?.message ?? response.statusText}` }
  }

  return {
    success: true,
    messageId: data.message_id,
    recipientId: data.recipient_id,
  }
}
