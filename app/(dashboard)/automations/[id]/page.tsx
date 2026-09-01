'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'

interface Automation {
  id: string
  name: string
  keyword: string
  match_type: string
  media_id: string | null
  is_active: boolean
  dm_message: string
  button_text: string | null
  button_url: string | null
  created_at: string
  automation_executions: Array<{
    id: string
    status: string
    created_at: string
    instagram_comment_id: string
  }>
}

export default function AutomationDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const [automation, setAutomation] = useState<Automation | null>(null)
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')
  const [success, setSuccess] = useState('')
  const router = useRouter()

  const [form, setForm] = useState({
    name: '',
    keyword: '',
    matchType: 'contains' as 'exact' | 'contains' | 'starts_with',
    dmMessage: '',
    buttonText: '',
    buttonUrl: '',
    isActive: true,
  })

  useEffect(() => {
    async function load() {
      const { id } = await params
      const res = await fetch(`/api/automations/${id}`)
      const data = await res.json()
      if (!res.ok) { setError(data.error); setLoading(false); return }
      const a = data.automation
      setAutomation(a)
      setForm({
        name: a.name,
        keyword: a.keyword,
        matchType: a.match_type,
        dmMessage: a.dm_message,
        buttonText: a.button_text ?? '',
        buttonUrl: a.button_url ?? '',
        isActive: a.is_active,
      })
      setLoading(false)
    }
    load()
  }, [params])

  async function handleSave() {
    setSaving(true)
    setError('')
    setSuccess('')
    try {
      const { id } = await params
      const res = await fetch(`/api/automations/${id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: form.name,
          keyword: form.keyword,
          matchType: form.matchType,
          dmMessage: form.dmMessage,
          buttonText: form.buttonText || null,
          buttonUrl: form.buttonUrl || null,
          isActive: form.isActive,
        }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error)
      setAutomation(data.automation)
      setSuccess('Saved successfully!')
      setTimeout(() => setSuccess(''), 3000)
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Save failed')
    } finally {
      setSaving(false)
    }
  }

  async function handleDelete() {
    if (!automation) return
    if (!confirm(`Delete "${automation.name}"? This cannot be undone.`)) return
    const { id } = await params
    await fetch(`/api/automations/${id}`, { method: 'DELETE' })
    router.push('/automations')
  }

  if (loading) return <div style={{ display: 'flex', justifyContent: 'center', padding: '64px' }}><div className="spinner" style={{ width: '32px', height: '32px' }} /></div>

  if (!automation) return (
    <div className="empty-state">
      <div className="empty-state-icon">🤖</div>
      <div className="empty-state-title">Automation not found</div>
      <Link href="/automations" className="btn btn-primary" style={{ marginTop: '16px' }}>Back to automations</Link>
    </div>
  )

  const executions = automation.automation_executions ?? []
  const sent = executions.filter((e) => e.status === 'sent').length
  const failed = executions.filter((e) => e.status === 'failed').length

  return (
    <div className="animate-fade-in" style={{ maxWidth: '800px' }}>
      <div className="page-header">
        <div>
          <Link href="/automations" className="btn btn-ghost btn-sm" style={{ marginBottom: '8px', padding: '4px 0' }}>← Automations</Link>
          <h1 className="page-title gradient-text">{automation.name}</h1>
          <div style={{ display: 'flex', gap: '8px', marginTop: '6px' }}>
            <span className={`badge ${automation.is_active ? 'badge-active' : 'badge-inactive'}`}>
              <span className={`dot ${automation.is_active ? 'dot-pulse' : ''}`} />
              {automation.is_active ? 'Active' : 'Inactive'}
            </span>
            <span className="badge badge-purple">{form.matchType}</span>
          </div>
        </div>
        <button className="btn btn-danger btn-sm" onClick={handleDelete}>Delete</button>
      </div>

      {/* Stats */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '12px', marginBottom: '24px' }}>
        {[
          { label: 'Total triggers', value: executions.length, icon: '💬' },
          { label: 'DMs sent', value: sent, icon: '✉️' },
          { label: 'Failures', value: failed, icon: '❌' },
        ].map((s) => (
          <div key={s.label} className="stat-card">
            <div style={{ fontSize: '20px' }}>{s.icon}</div>
            <div className="stat-value">{s.value}</div>
            <div className="stat-label">{s.label}</div>
          </div>
        ))}
      </div>

      {/* Edit form */}
      <div className="card" style={{ marginBottom: '20px' }}>
        <h2 style={{ fontSize: '16px', fontWeight: 600, marginBottom: '20px' }}>Edit Automation</h2>
        <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px' }}>
            <div>
              <label className="label">Name</label>
              <input className="input" value={form.name} onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))} />
            </div>
            <div>
              <label className="label">Keyword</label>
              <input className="input" value={form.keyword} onChange={(e) => setForm((f) => ({ ...f, keyword: e.target.value }))} style={{ textTransform: 'uppercase', fontWeight: 600 }} />
            </div>
          </div>
          <div>
            <label className="label">Match Type</label>
            <select className="input" value={form.matchType} onChange={(e) => setForm((f) => ({ ...f, matchType: e.target.value as typeof form.matchType }))}>
              <option value="exact">Exact match</option>
              <option value="contains">Contains keyword</option>
              <option value="starts_with">Starts with keyword</option>
            </select>
          </div>
          <div>
            <label className="label">DM Message</label>
            <textarea className="input" value={form.dmMessage} onChange={(e) => setForm((f) => ({ ...f, dmMessage: e.target.value }))} rows={4} />
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 2fr', gap: '16px' }}>
            <div>
              <label className="label">Button Text</label>
              <input className="input" value={form.buttonText} onChange={(e) => setForm((f) => ({ ...f, buttonText: e.target.value }))} placeholder="Get the Link" />
            </div>
            <div>
              <label className="label">Button URL (HTTPS only)</label>
              <input className="input" type="url" value={form.buttonUrl} onChange={(e) => setForm((f) => ({ ...f, buttonUrl: e.target.value }))} placeholder="https://..." />
            </div>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
            <label className="toggle">
              <input type="checkbox" checked={form.isActive} onChange={(e) => setForm((f) => ({ ...f, isActive: e.target.checked }))} />
              <span className="toggle-slider" />
            </label>
            <span style={{ fontSize: '14px' }}>{form.isActive ? 'Active — will send DMs' : 'Inactive — paused'}</span>
          </div>
        </div>

        {error && <div className="alert alert-error" style={{ marginTop: '16px' }}>{error}</div>}
        {success && <div className="alert alert-success" style={{ marginTop: '16px' }}>{success}</div>}

        <div style={{ marginTop: '20px' }}>
          <button className="btn btn-primary" onClick={handleSave} disabled={saving}>
            {saving ? <><span className="spinner" /> Saving…</> : '💾 Save changes'}
          </button>
        </div>
      </div>

      {/* Execution history */}
      <div className="card">
        <h2 style={{ fontSize: '16px', fontWeight: 600, marginBottom: '16px' }}>Execution History</h2>
        {executions.length === 0 ? (
          <div className="empty-state" style={{ padding: '32px' }}>
            <div style={{ fontSize: '32px', marginBottom: '8px' }}>💬</div>
            <p className="text-muted">No executions yet. Waiting for matching comments.</p>
          </div>
        ) : (
          <div className="table-wrap">
            <table>
              <thead>
                <tr><th>Time</th><th>Comment ID</th><th>Status</th></tr>
              </thead>
              <tbody>
                {executions.slice(0, 20).map((e) => (
                  <tr key={e.id}>
                    <td className="text-muted">{new Date(e.created_at).toLocaleString()}</td>
                    <td><code style={{ fontSize: '12px' }}>{e.instagram_comment_id}</code></td>
                    <td>
                      {e.status === 'sent' && <span className="badge badge-success">✓ Sent</span>}
                      {e.status === 'failed' && <span className="badge badge-failed">✕ Failed</span>}
                      {e.status === 'skipped' && <span className="badge badge-inactive">— Skipped</span>}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  )
}
