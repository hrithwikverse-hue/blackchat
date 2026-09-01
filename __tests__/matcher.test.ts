/**
 * __tests__/matcher.test.ts
 *
 * Unit tests for the automation keyword matching logic.
 * These tests do NOT require Meta API calls or a database.
 * Run with: npm test
 */

import { describe, it, expect } from 'vitest'
import {
  normalizeText,
  matchesKeyword,
  matchAutomation,
  type Automation,
  type CommentContext,
} from '@/lib/automation/matcher'

// =============================================
// normalizeText
// =============================================

describe('normalizeText', () => {
  it('lowercases text', () => {
    expect(normalizeText('GUIDE')).toBe('guide')
  })

  it('trims leading and trailing whitespace', () => {
    expect(normalizeText('  guide  ')).toBe('guide')
  })

  it('removes punctuation', () => {
    expect(normalizeText('guide!')).toBe('guide')
    expect(normalizeText('guide?')).toBe('guide')
    expect(normalizeText('guide.')).toBe('guide')
  })

  it('collapses multiple spaces', () => {
    expect(normalizeText('hello  world')).toBe('hello world')
  })

  it('handles mixed case and punctuation', () => {
    expect(normalizeText('  GUIDE!!! ')).toBe('guide')
  })

  it('handles empty string', () => {
    expect(normalizeText('')).toBe('')
  })
})

// =============================================
// matchesKeyword — exact
// =============================================

describe('matchesKeyword (exact)', () => {
  it('matches exact keyword', () => {
    expect(matchesKeyword('guide', 'guide', 'exact')).toBe(true)
  })

  it('matches exact keyword case-insensitively', () => {
    expect(matchesKeyword('GUIDE', 'guide', 'exact')).toBe(true)
    expect(matchesKeyword('Guide', 'GUIDE', 'exact')).toBe(true)
  })

  it('does NOT match if comment has additional words', () => {
    expect(matchesKeyword('guide please', 'guide', 'exact')).toBe(false)
  })

  it('does NOT match wrong keyword', () => {
    expect(matchesKeyword('price', 'guide', 'exact')).toBe(false)
  })

  it('matches with trailing punctuation stripped', () => {
    expect(matchesKeyword('guide!', 'guide', 'exact')).toBe(true)
    expect(matchesKeyword('GUIDE?', 'guide', 'exact')).toBe(true)
  })
})

// =============================================
// matchesKeyword — contains
// =============================================

describe('matchesKeyword (contains)', () => {
  it('matches when comment contains the keyword', () => {
    expect(matchesKeyword('can you send the guide', 'guide', 'contains')).toBe(true)
  })

  it('matches case-insensitively', () => {
    expect(matchesKeyword('Can you send me the GUIDE?', 'guide', 'contains')).toBe(true)
  })

  it('matches with punctuation in comment', () => {
    expect(matchesKeyword('send GUIDE please!', 'guide', 'contains')).toBe(true)
  })

  it('does NOT match wrong keyword', () => {
    expect(matchesKeyword('send price please', 'guide', 'contains')).toBe(false)
  })

  it('handles multi-word keyword', () => {
    expect(matchesKeyword('I need the free guide', 'free guide', 'contains')).toBe(true)
  })

  it('matches original spec example', () => {
    // "Can you send GUIDE?" → keyword "guide" → contains → true
    expect(matchesKeyword('Can you send GUIDE?', 'guide', 'contains')).toBe(true)
  })

  it('is case-insensitive for keyword too', () => {
    expect(matchesKeyword('please send guide', 'GUIDE', 'contains')).toBe(true)
  })
})

// =============================================
// matchesKeyword — starts_with
// =============================================

describe('matchesKeyword (starts_with)', () => {
  it('matches when comment starts with keyword', () => {
    expect(matchesKeyword('guide please', 'guide', 'starts_with')).toBe(true)
  })

  it('matches exactly the keyword at start', () => {
    expect(matchesKeyword('guide', 'guide', 'starts_with')).toBe(true)
  })

  it('does NOT match when keyword is NOT at start', () => {
    expect(matchesKeyword('send me guide', 'guide', 'starts_with')).toBe(false)
  })

  it('is case-insensitive', () => {
    expect(matchesKeyword('GUIDE please!', 'guide', 'starts_with')).toBe(true)
  })
})

// =============================================
// matchAutomation
// =============================================

const makeAutomation = (overrides: Partial<Automation> = {}): Automation => ({
  id: '1',
  name: 'Test',
  instagram_account_id: 'acc1',
  media_id: null,
  keyword: 'guide',
  match_type: 'contains',
  dm_message: 'Hey! Here is the guide.',
  button_text: 'Get Guide',
  button_url: 'https://example.com/guide',
  is_active: true,
  ...overrides,
})

describe('matchAutomation', () => {
  it('returns matching automation', () => {
    const automations = [makeAutomation()]
    const comment: CommentContext = { commentText: 'send me the guide', mediaId: 'media1' }
    expect(matchAutomation(comment, automations)).not.toBeNull()
  })

  it('returns null when no automations', () => {
    expect(matchAutomation({ commentText: 'guide', mediaId: 'm1' }, [])).toBeNull()
  })

  it('skips inactive automations', () => {
    const automations = [makeAutomation({ is_active: false })]
    expect(matchAutomation({ commentText: 'guide', mediaId: 'm1' }, automations)).toBeNull()
  })

  it('matches when automation.media_id is null (any post)', () => {
    const automations = [makeAutomation({ media_id: null })]
    expect(matchAutomation({ commentText: 'guide', mediaId: 'any_media_id' }, automations)).not.toBeNull()
  })

  it('matches when automation.media_id matches comment.mediaId', () => {
    const automations = [makeAutomation({ media_id: 'media_abc' })]
    expect(matchAutomation({ commentText: 'guide', mediaId: 'media_abc' }, automations)).not.toBeNull()
  })

  it('does NOT match when media_id does not match', () => {
    const automations = [makeAutomation({ media_id: 'media_abc' })]
    expect(matchAutomation({ commentText: 'guide', mediaId: 'media_xyz' }, automations)).toBeNull()
  })

  it('returns null when keyword does not match', () => {
    const automations = [makeAutomation({ keyword: 'guide' })]
    expect(matchAutomation({ commentText: 'something unrelated', mediaId: 'm1' }, automations)).toBeNull()
  })

  it('returns first match when multiple automations match', () => {
    const auto1 = makeAutomation({ id: '1', keyword: 'guide' })
    const auto2 = makeAutomation({ id: '2', keyword: 'guide' })
    const result = matchAutomation({ commentText: 'send guide', mediaId: 'm1' }, [auto1, auto2])
    expect(result?.id).toBe('1')
  })

  it('skips inactive and finds active', () => {
    const inactive = makeAutomation({ id: '1', is_active: false })
    const active = makeAutomation({ id: '2', is_active: true })
    const result = matchAutomation({ commentText: 'guide', mediaId: 'm1' }, [inactive, active])
    expect(result?.id).toBe('2')
  })

  it('handles duplicate webhook scenario (same comment text) — returns same automation', () => {
    const automations = [makeAutomation()]
    const comment = { commentText: 'guide please', mediaId: 'm1' }
    const r1 = matchAutomation(comment, automations)
    const r2 = matchAutomation(comment, automations)
    expect(r1?.id).toBe(r2?.id)
  })
})
