'use client'

import { useState, useEffect } from 'react'
import { matchAutomation, normalizeText } from '@/lib/automation/matcher'

interface Automation {
  id: string
  name: string
  keyword: string
  match_type: 'exact' | 'contains' | 'starts_with'
  media_id: string | null
  is_active: boolean
  dm_message: string
  button_text: string | null
  button_url: string | null
  instagram_account_id: string
}

export default function SettingsPage() {
  const [webhookUrl, setWebhookUrl] = useState('')
  const [verifyToken, setVerifyToken] = useState('')
  const [account, setAccount] = useState<{ username: string; token_expires_at?: string } | null>(null)
  const [loading, setLoading] = useState(true)

  // Test mode
  const [testComment, setTestComment] = useState('')
  const [testMediaId, setTestMediaId] = useState('')
  const [automations, setAutomations] = useState<Automation[]>([])
  const [testResult, setTestResult] = useState<string | null>(null)

  // Test send
  const [testCommentId, setTestCommentId] = useState('')
  const [testMessage, setTestMessage] = useState('')
  const [sendResult, setSendResult] = useState<string | null>(null)
  const [sending, setSending] = useState(false)

  useEffect(() => {
    // Derive webhook URL from current origin
    if (typeof window !== 'undefined') {
      setWebhookUrl(`${window.location.origin}/api/webhooks/instagram`)
    }
    // Load account and automations
    async function load() {
      const [statsRes, autoRes] = await Promise.all([
        fetch('/api/stats'),
        fetch('/api/automations'),
      ])
      if (statsRes.ok) {
        const d = await statsRes.json()
        setAccount(d.account ?? null)
      }
      if (autoRes.ok) {
        const d = await autoRes.json()
        setAutomations(d.automations ?? [])
      }
      setLoading(false)
    }
    load()
  }, [])

  async function handleDisconnect() {
    if (!confirm('Disconnect your Instagram account? Automations will stop working.')) return
    const res = await fetch('/api/instagram/disconnect', { method: 'POST' })
    if (res.ok) window.location.reload()
  }

  function handleTestKeyword() {
    if (!testComment.trim()) return
    const result = matchAutomation(
      { commentText: testComment, mediaId: testMediaId || '__any__' },
      automations.map((a) => ({ ...a }))
    )
    if (result) {
      setTestResult(`✅ MATCH — "${result.name}" (keyword: "${result.keyword}", type: ${result.match_type})`)
    } else {
      setTestResult('❌ No match — No active automation matched this comment.')
    }
  }

  async function handleTestSend() {
    if (!testCommentId.trim() || !testMessage.trim()) return
    setSending(true)
    setSendResult(null)
    try {
      const res = await fetch('/api/instagram/send-message', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ commentId: testCommentId, message: testMessage }),
      })
      const data = await res.json()
      if (data.success) {
        setSendResult(`✅ Message sent! Message ID: ${data.messageId ?? 'n/a'}\n${data.note}`)
      } else {
        setSendResult(`❌ Failed: ${data.error}`)
      }
    } catch (e) {
      setSendResult(`❌ Error: ${e instanceof Error ? e.message : 'Unknown error'}`)
    } finally {
      setSending(false)
    }
  }

  if (loading) return <div style={{ display: 'flex', justifyContent: 'center', padding: '64px' }}><div className="spinner" style={{ width: '32px', height: '32px' }} /></div>

  const isExpired = account?.token_expires_at ? new Date(account.token_expires_at) < new Date() : false

  return (
    <div className="animate-fade-in" style={{ maxWidth: '720px' }}>
      <div className="page-header">
        <div>
          <h1 className="page-title gradient-text">Settings</h1>
          <p className="page-subtitle">Configure your Instagram connection and webhook</p>
        </div>
      </div>

      {/* Instagram Connection */}
      <div className="card" style={{ marginBottom: '20px' }}>
        <h2 style={{ fontSize: '16px', fontWeight: 600, marginBottom: '16px' }}>🔗 Instagram Connection</h2>
        {account && !isExpired ? (
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '16px' }}>
              <div style={{ width: '44px', height: '44px', borderRadius: '50%', background: 'linear-gradient(135deg, #f09433, #dc2743, #bc1888)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '20px' }}>📷</div>
              <div>
                <div style={{ fontWeight: 600 }}>@{account.username}</div>
                <span className="badge badge-active"><span className="dot dot-pulse" /> Connected</span>
              </div>
            </div>
            {account.token_expires_at && (
              <div className="text-muted" style={{ fontSize: '13px', marginBottom: '12px' }}>
                Token expires: {new Date(account.token_expires_at).toLocaleDateString()}
              </div>
            )}
            <div style={{ display: 'flex', gap: '8px' }}>
              <a href="/api/instagram/connect" className="btn btn-secondary btn-sm">🔄 Reconnect</a>
              <button className="btn btn-danger btn-sm" onClick={handleDisconnect}>Disconnect</button>
            </div>
          </div>
        ) : isExpired ? (
          <div>
            <div className="alert alert-warning" style={{ marginBottom: '12px' }}>
              ⚠️ Your Instagram token has expired. Please reconnect to resume automations.
            </div>
            <a href="/api/instagram/connect" className="btn btn-primary">🔄 Reconnect Instagram</a>
          </div>
        ) : (
          <div>
            <p className="text-muted" style={{ fontSize: '14px', marginBottom: '12px' }}>
              Connect your Instagram Creator account to enable automations.
            </p>
            <a href="/api/instagram/connect" className="btn btn-primary">🔗 Connect Instagram</a>
          </div>
        )}
      </div>

      {/* Webhook URL */}
      <div className="card" style={{ marginBottom: '20px' }}>
        <h2 style={{ fontSize: '16px', fontWeight: 600, marginBottom: '8px' }}>🌐 Webhook Configuration</h2>
        <p className="text-muted" style={{ fontSize: '13px', marginBottom: '16px' }}>
          Use this URL in the Meta Developer Dashboard under Instagram &rsaquo; Webhooks. For local development, use a Cloudflare Tunnel URL.
        </p>

        <div>
          <div className="label">Webhook Callback URL</div>
          <div className="code-block" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '8px' }}>
            <code style={{ flex: 1, wordBreak: 'break-all', fontSize: '12px' }}>{webhookUrl}</code>
            <button
              className="btn btn-secondary btn-sm"
              onClick={() => navigator.clipboard.writeText(webhookUrl)}
            >
              Copy
            </button>
          </div>
        </div>

        <div style={{ marginTop: '12px' }}>
          <div className="label">Verify Token</div>
          <p className="text-muted" style={{ fontSize: '13px' }}>
            Set in <code style={{ color: 'var(--color-accent-light)' }}>.env.local</code> as <code style={{ color: 'var(--color-accent-light)' }}>META_VERIFY_TOKEN=your_random_string</code>
          </p>
        </div>

        <div className="alert alert-info" style={{ marginTop: '14px', fontSize: '13px' }}>
          <span>ℹ️</span>
          <div>
            <strong>For local development:</strong> Run <code>cloudflared tunnel --url http://localhost:3000</code> and use the generated HTTPS URL + <code>/api/webhooks/instagram</code> as the callback URL in Meta.
          </div>
        </div>

        <div style={{ marginTop: '16px' }}>
          <div className="label">Subscribe to these webhook fields:</div>
          <div style={{ display: 'flex', gap: '8px', marginTop: '6px', flexWrap: 'wrap' }}>
            {['comments', 'live_comments', 'messages'].map((field) => (
              <span key={field} className="badge badge-purple">{field}</span>
            ))}
          </div>
        </div>
      </div>

      {/* Test Mode — Keyword Matching */}
      <div className="card" style={{ marginBottom: '20px' }}>
        <h2 style={{ fontSize: '16px', fontWeight: 600, marginBottom: '4px' }}>🧪 Test: Keyword Matching</h2>
        <div className="badge badge-pending" style={{ fontSize: '11px', marginBottom: '12px' }}>TEST MODE — No real DM sent</div>
        <p className="text-muted" style={{ fontSize: '13px', marginBottom: '16px' }}>
          Test whether a comment would match one of your active automations without sending a real DM.
        </p>
        <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
          <div>
            <label className="label">Simulated comment text</label>
            <input
              type="text"
              className="input"
              value={testComment}
              onChange={(e) => setTestComment(e.target.value)}
              placeholder="Can you send me the GUIDE?"
            />
          </div>
          <div>
            <label className="label">Post/Reel ID (optional — leave blank to match &ldquo;any post&rdquo;)</label>
            <input
              type="text"
              className="input"
              value={testMediaId}
              onChange={(e) => setTestMediaId(e.target.value)}
              placeholder="18123456789"
            />
          </div>
          {testComment && (
            <div className="text-muted" style={{ fontSize: '12px' }}>
              Normalized: <code style={{ color: 'var(--color-accent-light)' }}>&ldquo;{normalizeText(testComment)}&rdquo;</code>
            </div>
          )}
          <button className="btn btn-secondary" onClick={handleTestKeyword} disabled={!testComment.trim()}>
            Test matching
          </button>
          {testResult && (
            <div className={`alert ${testResult.startsWith('✅') ? 'alert-success' : 'alert-error'}`}>
              {testResult}
            </div>
          )}
        </div>
      </div>

      {/* Test Mode — Send Real DM */}
      <div className="card" style={{ marginBottom: '20px' }}>
        <h2 style={{ fontSize: '16px', fontWeight: 600, marginBottom: '4px' }}>📤 Test: Send Private Reply</h2>
        <div className="badge badge-failed" style={{ fontSize: '11px', marginBottom: '12px' }}>LIVE — Sends a real DM (prefixed with [TEST])</div>
        <div className="alert alert-warning" style={{ marginBottom: '16px', fontSize: '13px' }}>
          <span>⚠️</span>
          This sends a <strong>real DM</strong> via the Meta API. Use a comment ID from a test comment you made on your own post. The message will be prefixed with [TEST].
        </div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
          <div>
            <label className="label">Comment ID (from Instagram comment URL or webhook log)</label>
            <input
              type="text"
              className="input"
              value={testCommentId}
              onChange={(e) => setTestCommentId(e.target.value)}
              placeholder="17858893269000001"
            />
          </div>
          <div>
            <label className="label">Test message</label>
            <input
              type="text"
              className="input"
              value={testMessage}
              onChange={(e) => setTestMessage(e.target.value)}
              placeholder="Hello! This is a test message."
            />
          </div>
          <button className="btn btn-primary" onClick={handleTestSend} disabled={sending || !testCommentId.trim() || !testMessage.trim()}>
            {sending ? <><span className="spinner" /> Sending…</> : '📤 Send test DM'}
          </button>
          {sendResult && (
            <div className={`alert ${sendResult.startsWith('✅') ? 'alert-success' : 'alert-error'}`} style={{ whiteSpace: 'pre-wrap', fontSize: '13px' }}>
              {sendResult}
            </div>
          )}
        </div>
      </div>

      {/* API Info */}
      <div className="card">
        <h2 style={{ fontSize: '16px', fontWeight: 600, marginBottom: '12px' }}>ℹ️ API Information</h2>
        <div style={{ display: 'flex', flexDirection: 'column', gap: '10px', fontSize: '14px' }}>
          <div style={{ display: 'grid', gridTemplateColumns: '180px 1fr', gap: '8px' }}>
            <span className="text-muted">Meta Graph API Version</span>
            <code style={{ color: 'var(--color-accent-light)' }}>{process.env.NEXT_PUBLIC_META_API_VERSION ?? 'v22.0 (default)'}</code>
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: '180px 1fr', gap: '8px' }}>
            <span className="text-muted">Required permissions</span>
            <div style={{ display: 'flex', gap: '4px', flexWrap: 'wrap' }}>
              {['instagram_business_basic', 'instagram_business_manage_comments', 'instagram_business_manage_messages', 'pages_show_list'].map((p) => (
                <span key={p} className="badge badge-purple" style={{ fontSize: '11px' }}>{p}</span>
              ))}
            </div>
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: '180px 1fr', gap: '8px' }}>
            <span className="text-muted">Private reply window</span>
            <span>7 days from comment creation</span>
          </div>
        </div>
      </div>
    </div>
  )
}
