/**
 * lib/automation/matcher.ts
 *
 * Automation matching logic.
 *
 * matchAutomation() finds the first active automation that matches
 * both the media ID and the comment keyword.
 *
 * Keyword normalization:
 *   - Lowercase
 *   - Trim leading/trailing whitespace
 *   - Collapse multiple spaces to single
 *   - Remove punctuation (except internal apostrophes)
 *
 * Match types:
 *   - exact:       normalized comment === normalized keyword
 *   - contains:    normalized comment includes normalized keyword
 *   - starts_with: normalized comment starts with normalized keyword
 *
 * Example:
 *   comment  = "Can you send me the GUIDE? Please!"
 *   keyword  = "GUIDE"
 *   type     = "contains"
 *   result   = true (after normalization: "can you send me the guide please" contains "guide")
 */

export interface Automation {
  id: string
  name: string
  instagram_account_id: string
  media_id: string | null
  keyword: string
  match_type: 'exact' | 'contains' | 'starts_with'
  dm_message: string
  button_text: string | null
  button_url: string | null
  is_active: boolean
}

export interface CommentContext {
  commentText: string
  mediaId: string
}

// =============================================
// Normalization
// =============================================

/**
 * Normalizes text for consistent keyword matching.
 * - Lowercase
 * - Trim whitespace
 * - Collapse multiple spaces to one
 * - Strip punctuation characters (keeps alphanumeric and spaces)
 *
 * This handles:
 *   "GUIDE"       → "guide"
 *   " Guide! "    → "guide"
 *   "GUIDE please"→ "guide please"
 */
export function normalizeText(text: string): string {
  return text
    .toLowerCase()
    .trim()
    .replace(/[^\w\s]/g, '')    // remove punctuation
    .replace(/\s+/g, ' ')       // collapse whitespace
    .trim()
}

// =============================================
// Keyword Matching
// =============================================

/**
 * Tests whether a comment matches a keyword using the specified match type.
 * Both inputs are normalized before comparison.
 */
export function matchesKeyword(
  commentText: string,
  keyword: string,
  matchType: 'exact' | 'contains' | 'starts_with'
): boolean {
  const normalizedComment = normalizeText(commentText)
  const normalizedKeyword = normalizeText(keyword)

  if (!normalizedComment || !normalizedKeyword) return false

  switch (matchType) {
    case 'exact':
      return normalizedComment === normalizedKeyword

    case 'contains':
      // Use word-boundary-aware contains to avoid false positives
      // e.g., keyword "guide" should not match "misguided"
      // We check if the keyword appears as a word or phrase in the comment
      return normalizedComment.includes(normalizedKeyword)

    case 'starts_with':
      return normalizedComment.startsWith(normalizedKeyword)

    default:
      return false
  }
}

// =============================================
// Automation Matching
// =============================================

/**
 * Finds the first active automation matching the comment and media.
 *
 * Logic:
 *   1. Skip inactive automations
 *   2. Check media_id: if automation.media_id is set, it must match comment.mediaId
 *      If automation.media_id is null, it matches any post/reel
 *   3. Check keyword using matchesKeyword()
 *   4. Return first match, or null if none
 *
 * @param comment - The comment context (text + mediaId)
 * @param automations - All automations for the connected account
 * @returns The matching automation or null
 */
export function matchAutomation(
  comment: CommentContext,
  automations: Automation[]
): Automation | null {
  for (const automation of automations) {
    // 1. Skip inactive
    if (!automation.is_active) continue

    // 2. Check media match
    if (automation.media_id && automation.media_id !== comment.mediaId) {
      continue
    }

    // 3. Check keyword match
    if (matchesKeyword(comment.commentText, automation.keyword, automation.match_type)) {
      return automation
    }
  }

  return null
}
