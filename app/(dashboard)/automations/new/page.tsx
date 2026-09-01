'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import type { InstagramMedia } from '@/lib/meta/instagram'

// =============================================
// Types
// =============================================

interface FormData {
  name: string
  mediaId: string | null    // null = any post/reel
  keyword: string
  matchType: 'exact' | 'contains' | 'starts_with'
  dmMessage: string
  buttonText: string
  buttonUrl: string
  isActive: boolean
}

const INITIAL_FORM: FormData = {
  name: '',
  mediaId: null,
  keyword: '',
  matchType: 'contains',
  dmMessage: '',
  buttonText: 'Get the Link',
  buttonUrl: '',
  isActive: true,
}

type Step = 1 | 2 | 3 | 4

// =============================================
// Step 1: Select Media
// =============================================

function StepMedia({
  value,
  onChange,
}: {
  value: string | null
  onChange: (v: string | null) => void
}) {
  const [media, setMedia] = useState<InstagramMedia[]>([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [loaded, setLoaded] = useState(false)

  async function loadMedia() {
    if (loaded) return
    setLoading(true)
    setError('')
    try {
      const res = await fetch('/api/instagram/posts')
      const data = await res.json()
      if (!res.ok) throw new Error(data.error ?? 'Failed to load posts')
      setMedia(data.media ?? [])
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to load posts')
    } finally {
      setLoading(false)
      setLoaded(true)
    }
  }

  function formatDate(ts: string) {
    return new Date(ts).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })
  }

  return (
    <div>
      <h2 style={{ fontSize: '18px', fontWeight: 600, marginBottom: '8px' }}>Select Instagram Content</h2>
      <p className="text-muted" style={{ fontSize: '14px', marginBottom: '20px' }}>
        Choose which post or reel triggers this automation, or select &ldquo;Any post&rdquo;.
      </p>

      {/* Any post option */}
      <div
        className={`media-card ${value === null ? 'selected' : ''}`}
        onClick={() => onChange(null)}
        style={{ padding: '16px', marginBottom: '12px', display: 'flex', alignItems: 'center', gap: '12px' }}
      >
        <div style={{
          width: '48px', height: '48px', borderRadius: '8px',
          background: 'var(--color-accent-glow)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '22px', flexShrink: 0,
        }}>🌐</div>
        <div>
          <div style={{ fontWeight: 600, marginBottom: '2px' }}>Any post or reel</div>
          <div className="text-muted" style={{ fontSize: '13px' }}>Trigger on comments from any of your posts</div>
        </div>
        {value === null && <div style={{ marginLeft: 'auto', color: 'var(--color-accent-light)', fontSize: '20px' }}>✓</div>}
      </div>

      {/* Load posts button */}
      {!loaded && (
        <button className="btn btn-secondary" onClick={loadMedia} disabled={loading}>
          {loading ? <><span className="spinner" /> Loading posts…</> : '📥 Load my posts & reels'}
        </button>
      )}

      {error && <div className="alert alert-error" style={{ marginTop: '12px' }}>{error}</div>}

      {/* Media grid */}
      {media.length > 0 && (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(200px, 1fr))', gap: '12px', marginTop: '12px' }}>
          {media.map((item) => (
            <div
              key={item.id}
              className={`media-card ${value === item.id ? 'selected' : ''}`}
              onClick={() => onChange(item.id)}
            >
              {/* Thumbnail */}
              <div style={{ position: 'relative', paddingBottom: '100%', background: 'var(--color-surface-2)' }}>
                {(item.thumbnail_url || item.media_url) ? (
                  <img
                    src={item.thumbnail_url || item.media_url}
                    alt={item.caption?.slice(0, 40) ?? 'Post'}
                    style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', objectFit: 'cover' }}
                  />
                ) : (
                  <div style={{ position: 'absolute', inset: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '32px' }}>
                    {item.media_type === 'VIDEO' ? '🎬' : item.media_type === 'REELS' ? '🎬' : '🖼️'}
                  </div>
                )}
                {value === item.id && (
                  <div style={{
                    position: 'absolute', inset: 0, background: 'rgba(124,58,237,0.3)',
                    display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '32px'
                  }}>✓</div>
                )}
                <div style={{ position: 'absolute', top: '8px', right: '8px' }}>
                  <span className="badge badge-purple" style={{ fontSize: '11px' }}>
                    {item.media_type === 'VIDEO' || item.media_type === 'REELS' ? '🎬 Reel' : '🖼️ Post'}
                  </span>
                </div>
              </div>
              <div style={{ padding: '10px' }}>
                <div style={{ fontSize: '12px', color: 'var(--color-text-muted)', marginBottom: '4px' }}>{formatDate(item.timestamp)}</div>
                <div style={{ fontSize: '13px', lineHeight: '1.4', overflow: 'hidden', display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical' }}>
                  {item.caption?.slice(0, 80) ?? 'No caption'}
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}

// =============================================
// Step 2: Keyword / Trigger
// =============================================

function StepTrigger({ form, onChange }: { form: FormData; onChange: (f: Partial<FormData>) => void }) {
  return (
    <div>
      <h2 style={{ fontSize: '18px', fontWeight: 600, marginBottom: '8px' }}>Configure Trigger</h2>
      <p className="text-muted" style={{ fontSize: '14px', marginBottom: '20px' }}>
        Set the keyword that triggers the DM. Matching is case-insensitive.
      </p>

      <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
        <div>
          <label className="label" htmlFor="keyword">Trigger Keyword *</label>
          <input
            id="keyword"
            type="text"
            className="input"
            value={form.keyword}
            onChange={(e) => onChange({ keyword: e.target.value })}
            placeholder="e.g. GUIDE, PRICE, FREE"
            style={{ textTransform: 'uppercase', fontWeight: 600, letterSpacing: '0.05em' }}
          />
          <div style={{ fontSize: '12px', color: 'var(--color-text-muted)', marginTop: '6px' }}>
            Will match: &ldquo;guide&rdquo;, &ldquo;GUIDE&rdquo;, &ldquo;Guide!&rdquo; (all normalized)
          </div>
        </div>

        <div>
          <label className="label">Match Type *</label>
          <div className="radio-group">
            {([
              ['exact', 'Exact match', 'Comment must be exactly the keyword (e.g. "GUIDE" only)'],
              ['contains', 'Contains keyword', 'Comment includes the keyword anywhere (e.g. "send me the GUIDE")'],
              ['starts_with', 'Starts with keyword', 'Comment begins with the keyword'],
            ] as const).map(([val, label, desc]) => (
              <label key={val} className="radio-option">
                <input
                  type="radio"
                  name="matchType"
                  value={val}
                  checked={form.matchType === val}
                  onChange={() => onChange({ matchType: val })}
                />
                <div>
                  <div style={{ fontWeight: 500, fontSize: '14px' }}>{label}</div>
                  <div className="text-muted" style={{ fontSize: '12px' }}>{desc}</div>
                </div>
              </label>
            ))}
          </div>
        </div>

        {/* Preview */}
        {form.keyword && (
          <div className="alert alert-info">
            <span>💡</span>
            <div style={{ fontSize: '13px' }}>
              <strong>Preview:</strong> A comment like{' '}
              <em>&ldquo;{
                form.matchType === 'exact' ? form.keyword :
                form.matchType === 'contains' ? `Can you send me the ${form.keyword}?` :
                `${form.keyword} please send it`
              }&rdquo;</em>{' '}
              will <strong>match</strong> this automation.
            </div>
          </div>
        )}
      </div>
    </div>
  )
}

// =============================================
// Step 3: DM Message
// =============================================

function StepDM({ form, onChange }: { form: FormData; onChange: (f: Partial<FormData>) => void }) {
  const preview = form.dmMessage.trim() +
    (form.buttonUrl ? `\n\n${form.buttonText || 'Link'}: ${form.buttonUrl}` : '')

  return (
    <div>
      <h2 style={{ fontSize: '18px', fontWeight: 600, marginBottom: '8px' }}>Configure DM Message</h2>
      <p className="text-muted" style={{ fontSize: '14px', marginBottom: '20px' }}>
        Write the private DM that will be sent when the keyword is matched.
        Instagram DMs are plain text — the link will be appended automatically.
      </p>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '24px' }}>
        <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
          <div>
            <label className="label" htmlFor="dmMessage">Message text *</label>
            <textarea
              id="dmMessage"
              className="input"
              value={form.dmMessage}
              onChange={(e) => onChange({ dmMessage: e.target.value })}
              placeholder="Hey! Thanks for commenting 👋&#10;&#10;Here's what you asked for:"
              rows={5}
            />
            <div className="text-muted" style={{ fontSize: '12px', marginTop: '4px' }}>
              {form.dmMessage.length}/1000 characters
            </div>
          </div>

          <div>
            <label className="label" htmlFor="buttonText">Button / link label</label>
            <input
              id="buttonText"
              type="text"
              className="input"
              value={form.buttonText}
              onChange={(e) => onChange({ buttonText: e.target.value })}
              placeholder="Get the Guide"
            />
          </div>

          <div>
            <label className="label" htmlFor="buttonUrl">Link URL (HTTPS only)</label>
            <input
              id="buttonUrl"
              type="url"
              className="input"
              value={form.buttonUrl}
              onChange={(e) => onChange({ buttonUrl: e.target.value })}
              placeholder="https://example.com/guide"
            />
            {form.buttonUrl && !form.buttonUrl.startsWith('https://') && (
              <div className="field-error">URL must start with https://</div>
            )}
          </div>
        </div>

        {/* DM Preview */}
        <div>
          <div className="label">DM Preview</div>
          <div style={{
            background: '#1a1a1f', borderRadius: '12px', padding: '16px',
            border: '1px solid var(--color-border)', minHeight: '180px',
          }}>
            <div style={{ display: 'flex', gap: '8px', marginBottom: '12px', alignItems: 'center' }}>
              <div style={{ width: '32px', height: '32px', borderRadius: '50%', background: 'linear-gradient(135deg, #7c3aed, #4f46e5)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '14px' }}>
                ⚡
              </div>
              <span style={{ fontSize: '13px', fontWeight: 600 }}>Your Account</span>
            </div>
            <div style={{
              background: '#2a2a35', borderRadius: '12px 12px 12px 4px',
              padding: '12px 14px', fontSize: '14px', lineHeight: '1.5', maxWidth: '90%',
              whiteSpace: 'pre-wrap', wordBreak: 'break-word',
              color: preview ? 'var(--color-text)' : 'var(--color-text-dim)',
            }}>
              {preview || 'Your message will appear here…'}
            </div>
          </div>
          <div className="alert alert-info" style={{ marginTop: '12px', fontSize: '12px' }}>
            <span>ℹ️</span>
            Instagram DMs are plain text only. The link is appended as text.
          </div>
        </div>
      </div>
    </div>
  )
}

// =============================================
// Step 4: Review & Activate
// =============================================

function StepReview({ form, media }: { form: FormData; media: InstagramMedia[] }) {
  const selectedMedia = media.find((m) => m.id === form.mediaId)

  return (
    <div>
      <h2 style={{ fontSize: '18px', fontWeight: 600, marginBottom: '8px' }}>Review Automation</h2>
      <p className="text-muted" style={{ fontSize: '14px', marginBottom: '20px' }}>
        Confirm everything looks right before activating.
      </p>

      <div className="card" style={{ background: 'var(--color-surface-2)', marginBottom: '16px' }}>
        <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
          {[
            { label: 'Name', value: form.name },
            { label: 'Post / Reel', value: form.mediaId ? (selectedMedia?.caption?.slice(0, 60) ?? `ID: ${form.mediaId}`) : 'Any post or reel' },
            { label: 'Keyword', value: form.keyword.toUpperCase() },
            { label: 'Match type', value: { exact: 'Exact match', contains: 'Contains keyword', starts_with: 'Starts with keyword' }[form.matchType] },
            { label: 'DM message', value: form.dmMessage },
            ...(form.buttonUrl ? [{ label: 'Link', value: `${form.buttonText}: ${form.buttonUrl}` }] : []),
            { label: 'Status', value: form.isActive ? '● Active (will send DMs immediately)' : '○ Inactive (create paused)' },
          ].map(({ label, value }) => (
            <div key={label} style={{ display: 'grid', gridTemplateColumns: '140px 1fr', gap: '8px' }}>
              <span className="text-muted" style={{ fontSize: '13px', fontWeight: 500 }}>{label}</span>
              <span style={{ fontSize: '14px', wordBreak: 'break-word' }}>{value}</span>
            </div>
          ))}
        </div>
      </div>

      <div className="alert alert-warning">
        <span>⚠️</span>
        <div style={{ fontSize: '13px' }}>
          <strong>Meta API requirements:</strong> Ensure your Instagram account is connected and the <code>instagram_business_manage_messages</code> permission is approved. Private replies must be sent within 7 days of the comment.
        </div>
      </div>
    </div>
  )
}

// =============================================
// Main Wizard
// =============================================

const STEPS = [
  { num: 1, label: 'Select content' },
  { num: 2, label: 'Set trigger' },
  { num: 3, label: 'Write DM' },
  { num: 4, label: 'Review' },
]

export default function NewAutomationPage() {
  const [step, setStep] = useState<Step>(1)
  const [form, setForm] = useState<FormData>(INITIAL_FORM)
  const [media, setMedia] = useState<InstagramMedia[]>([])
  const [saving, setSaving] = useState(false)
  const [errors, setErrors] = useState<Record<string, string>>({})
  const router = useRouter()

  function updateForm(partial: Partial<FormData>) {
    setForm((prev) => ({ ...prev, ...partial }))
  }

  function validate(): boolean {
    const errs: Record<string, string> = {}
    if (step === 1) {
      if (!form.name.trim()) errs.name = 'Automation name is required'
    }
    if (step === 2) {
      if (!form.keyword.trim()) errs.keyword = 'Keyword is required'
    }
    if (step === 3) {
      if (!form.dmMessage.trim()) errs.dmMessage = 'DM message is required'
      if (form.buttonUrl && !form.buttonUrl.startsWith('https://')) {
        errs.buttonUrl = 'URL must start with https://'
      }
    }
    setErrors(errs)
    return Object.keys(errs).length === 0
  }

  function nextStep() {
    if (!validate()) return
    setStep((s) => Math.min(s + 1, 4) as Step)
  }

  async function handleSubmit() {
    setSaving(true)
    try {
      const res = await fetch('/api/automations', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: form.name,
          mediaId: form.mediaId,
          keyword: form.keyword,
          matchType: form.matchType,
          dmMessage: form.dmMessage,
          buttonText: form.buttonText || null,
          buttonUrl: form.buttonUrl || null,
          isActive: form.isActive,
        }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error ?? 'Failed to create automation')
      router.push('/automations')
    } catch (e) {
      setErrors({ submit: e instanceof Error ? e.message : 'Failed to save' })
      setSaving(false)
    }
  }

  return (
    <div className="animate-fade-in" style={{ maxWidth: '900px' }}>
      <div className="page-header">
        <div>
          <h1 className="page-title gradient-text">New Automation</h1>
          <p className="page-subtitle">Set up a keyword → DM automation in 4 steps</p>
        </div>
      </div>

      {/* Name input always visible at top */}
      {step === 1 && (
        <div className="card" style={{ marginBottom: '20px' }}>
          <label className="label" htmlFor="name">Automation name *</label>
          <input
            id="name"
            type="text"
            className={`input ${errors.name ? 'input-error' : ''}`}
            value={form.name}
            onChange={(e) => updateForm({ name: e.target.value })}
            placeholder="e.g. Free Guide DM"
          />
          {errors.name && <div className="field-error">{errors.name}</div>}
        </div>
      )}

      {/* Step indicator */}
      <div className="wizard-steps">
        {STEPS.map((s, i) => (
          <>
            <div
              key={s.num}
              className={`wizard-step ${step === s.num ? 'active' : step > s.num ? 'completed' : ''}`}
              style={{ cursor: step > s.num ? 'pointer' : 'default' }}
              onClick={() => { if (step > s.num) setStep(s.num as Step) }}
            >
              <div className="wizard-step-num">
                {step > s.num ? '✓' : s.num}
              </div>
              <span style={{ display: window?.innerWidth > 600 ? undefined : 'none' }}>{s.label}</span>
            </div>
            {i < STEPS.length - 1 && <div key={`c-${i}`} className="wizard-connector" />}
          </>
        ))}
      </div>

      {/* Step content */}
      <div className="card" style={{ marginBottom: '20px' }}>
        {step === 1 && <StepMedia value={form.mediaId} onChange={(v) => updateForm({ mediaId: v })} />}
        {step === 2 && <StepTrigger form={form} onChange={updateForm} />}
        {step === 3 && <StepDM form={form} onChange={updateForm} />}
        {step === 4 && <StepReview form={form} media={media} />}

        {errors.keyword && step === 2 && <div className="field-error" style={{ marginTop: '12px' }}>{errors.keyword}</div>}
        {errors.dmMessage && step === 3 && <div className="field-error" style={{ marginTop: '12px' }}>{errors.dmMessage}</div>}
        {errors.submit && <div className="alert alert-error" style={{ marginTop: '16px' }}>{errors.submit}</div>}
      </div>

      {/* Navigation */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <button
          className="btn btn-secondary"
          onClick={() => step > 1 ? setStep((s) => (s - 1) as Step) : router.push('/automations')}
        >
          ← {step > 1 ? 'Back' : 'Cancel'}
        </button>

        <div style={{ display: 'flex', gap: '12px', alignItems: 'center' }}>
          {step === 4 && (
            <label className="toggle" style={{ display: 'flex', alignItems: 'center', gap: '8px', cursor: 'pointer', fontSize: '14px' }}>
              <input type="checkbox" checked={form.isActive} onChange={(e) => updateForm({ isActive: e.target.checked })} />
              <span className="toggle-slider" />
              <span style={{ marginLeft: '8px' }}>{form.isActive ? 'Activate immediately' : 'Create as inactive'}</span>
            </label>
          )}
          {step < 4 ? (
            <button className="btn btn-primary" onClick={nextStep}>
              Next →
            </button>
          ) : (
            <button className="btn btn-primary btn-lg" onClick={handleSubmit} disabled={saving}>
              {saving ? <><span className="spinner" /> Saving…</> : '⚡ Activate Automation'}
            </button>
          )}
        </div>
      </div>
    </div>
  )
}
