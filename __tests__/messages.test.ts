/**
 * __tests__/messages.test.ts
 *
 * Tests for the messages utility — buildMessageText.
 * Does NOT make real Meta API calls.
 */

import { describe, it, expect } from 'vitest'
import { buildMessageText } from '@/lib/meta/messages'

describe('buildMessageText', () => {
  it('returns message text alone when no button', () => {
    expect(buildMessageText('Hello!')).toBe('Hello!')
  })

  it('appends URL with button text', () => {
    const result = buildMessageText('Here is your guide', 'Get Guide', 'https://example.com/guide')
    expect(result).toBe('Here is your guide\n\nGet Guide: https://example.com/guide')
  })

  it('uses "Link" as fallback label when buttonText is empty', () => {
    const result = buildMessageText('Check this out', '', 'https://example.com')
    expect(result).toBe('Check this out\n\nLink: https://example.com')
  })

  it('does not append when buttonUrl is null', () => {
    expect(buildMessageText('Hello', 'Get Guide', null)).toBe('Hello')
  })

  it('does not append when buttonUrl is undefined', () => {
    expect(buildMessageText('Hello', 'Get Guide', undefined)).toBe('Hello')
  })

  it('trims the message text', () => {
    const result = buildMessageText('  Hello!  ')
    expect(result).toBe('Hello!')
  })

  it('handles multiline messages', () => {
    const msg = 'Line 1\n\nLine 2'
    const result = buildMessageText(msg, 'Click here', 'https://example.com')
    expect(result).toBe('Line 1\n\nLine 2\n\nClick here: https://example.com')
  })
})
