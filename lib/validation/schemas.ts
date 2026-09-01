/**
 * lib/validation/schemas.ts
 *
 * Zod schemas for all form inputs, API request bodies, and URL validation.
 * These are used on the server side for API route validation and
 * on the client side for form validation.
 */

import { z } from 'zod'

// =============================================
// Shared primitives
// =============================================

/** Only HTTPS URLs are allowed in DM button links */
export const httpsUrlSchema = z
  .string()
  .url('Must be a valid URL')
  .refine((url) => url.startsWith('https://'), {
    message: 'URL must use HTTPS',
  })

export const matchTypeSchema = z.enum(['exact', 'contains', 'starts_with'])

// =============================================
// Automation schemas
// =============================================

export const createAutomationSchema = z.object({
  name: z.string().min(1, 'Name is required').max(100, 'Name too long'),
  mediaId: z.string().nullable().optional(),   // null = any post/reel
  keyword: z.string().min(1, 'Keyword is required').max(100, 'Keyword too long'),
  matchType: matchTypeSchema,
  dmMessage: z
    .string()
    .min(1, 'DM message is required')
    .max(1000, 'DM message must be under 1000 characters'),
  buttonText: z.string().max(100, 'Button text too long').optional().nullable(),
  buttonUrl: httpsUrlSchema.optional().nullable(),
  isActive: z.boolean().default(true),
})

export const updateAutomationSchema = createAutomationSchema.partial()

export type CreateAutomationInput = z.infer<typeof createAutomationSchema>
export type UpdateAutomationInput = z.infer<typeof updateAutomationSchema>

// =============================================
// Webhook verification schema (query params)
// =============================================

export const webhookVerifySchema = z.object({
  'hub.mode': z.literal('subscribe'),
  'hub.verify_token': z.string().min(1),
  'hub.challenge': z.string().min(1),
})

// =============================================
// Test webhook schema
// =============================================

export const testWebhookSchema = z.object({
  commentText: z.string().min(1).max(500),
  mediaId: z.string().optional().nullable(),
})

// =============================================
// Send message test schema (server-side only)
// =============================================

export const sendTestMessageSchema = z.object({
  commentId: z.string().min(1),
  message: z.string().min(1).max(1000),
})
