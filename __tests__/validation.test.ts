/**
 * __tests__/validation.test.ts
 *
 * Unit tests for Zod validation schemas.
 */

import { describe, it, expect } from 'vitest'
import { httpsUrlSchema, createAutomationSchema, webhookVerifySchema } from '@/lib/validation/schemas'

describe('httpsUrlSchema', () => {
  it('accepts valid HTTPS URLs', () => {
    expect(httpsUrlSchema.safeParse('https://example.com').success).toBe(true)
    expect(httpsUrlSchema.safeParse('https://example.com/path?q=1').success).toBe(true)
  })

  it('rejects HTTP URLs', () => {
    const result = httpsUrlSchema.safeParse('http://example.com')
    expect(result.success).toBe(false)
  })

  it('rejects non-URLs', () => {
    expect(httpsUrlSchema.safeParse('not-a-url').success).toBe(false)
    expect(httpsUrlSchema.safeParse('').success).toBe(false)
  })

  it('rejects ftp URLs', () => {
    expect(httpsUrlSchema.safeParse('ftp://example.com').success).toBe(false)
  })
})

describe('createAutomationSchema', () => {
  const valid = {
    name: 'Free Guide',
    keyword: 'guide',
    matchType: 'contains',
    dmMessage: 'Hey! Here is your guide.',
    isActive: true,
  }

  it('accepts valid automation', () => {
    expect(createAutomationSchema.safeParse(valid).success).toBe(true)
  })

  it('rejects empty name', () => {
    expect(createAutomationSchema.safeParse({ ...valid, name: '' }).success).toBe(false)
  })

  it('rejects empty keyword', () => {
    expect(createAutomationSchema.safeParse({ ...valid, keyword: '' }).success).toBe(false)
  })

  it('rejects empty dmMessage', () => {
    expect(createAutomationSchema.safeParse({ ...valid, dmMessage: '' }).success).toBe(false)
  })

  it('rejects invalid matchType', () => {
    expect(createAutomationSchema.safeParse({ ...valid, matchType: 'fuzzy' }).success).toBe(false)
  })

  it('rejects invalid button URL (http)', () => {
    expect(createAutomationSchema.safeParse({ ...valid, buttonUrl: 'http://example.com' }).success).toBe(false)
  })

  it('accepts valid HTTPS button URL', () => {
    expect(createAutomationSchema.safeParse({ ...valid, buttonUrl: 'https://example.com' }).success).toBe(true)
  })

  it('accepts null mediaId', () => {
    expect(createAutomationSchema.safeParse({ ...valid, mediaId: null }).success).toBe(true)
  })

  it('defaults isActive to true when not provided', () => {
    const { isActive: _, ...withoutActive } = valid
    const result = createAutomationSchema.safeParse(withoutActive)
    expect(result.success).toBe(true)
    if (result.success) expect(result.data.isActive).toBe(true)
  })
})

describe('webhookVerifySchema', () => {
  it('accepts valid verification params', () => {
    const params = {
      'hub.mode': 'subscribe',
      'hub.verify_token': 'my-secret-token',
      'hub.challenge': '12345',
    }
    expect(webhookVerifySchema.safeParse(params).success).toBe(true)
  })

  it('rejects wrong hub.mode', () => {
    expect(webhookVerifySchema.safeParse({
      'hub.mode': 'unsubscribe',
      'hub.verify_token': 'token',
      'hub.challenge': '123',
    }).success).toBe(false)
  })

  it('rejects missing challenge', () => {
    expect(webhookVerifySchema.safeParse({
      'hub.mode': 'subscribe',
      'hub.verify_token': 'token',
    }).success).toBe(false)
  })
})
