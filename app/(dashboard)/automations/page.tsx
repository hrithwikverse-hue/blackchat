'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'

interface Automation {
  id: string
  name: string
  keyword: string
  match_type: string
  media_id: string | null
  is_active: boolean
  dm_message: string
  button_url: string | null
  created_at: string
  automation_executions?: { count: number }[]
}

function MatchTypeBadge({ type }: { type: string }) {
  const labels: Record<string, string> = {
    exact: 'Exact',
    contains: 'Contains',
    starts_with: 'Starts with',
  }
  return <span className="badge badge-purple">{labels[type] ?? type}</span>
}

export default function AutomationsPage() {
  const [automations, setAutomations] = useState<Automation[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [togglingId, setTogglingId] = useState<string | null>(null)
  const [deletingId, setDeletingId] = useState<string | null>(null)

  useEffect(() => {
    fetchAutomations()
  }, [])

  async function fetchAutomations() {
    setLoading(true)
    try {
      const res = await fetch('/api/automations')
      const data = await res.json()
      if (data.error) throw new Error(data.error)
      setAutomations(data.automations ?? [])
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to load automations')
    } finally {
      setLoading(false)
    }
  }

  async function toggleActive(id: string, currentState: boolean) {
    setTogglingId(id)
    try {
      await fetch(`/api/automations/${id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ isActive: !currentState }),
      })
      setAutomations((prev) => prev.map((a) => a.id === id ? { ...a, is_active: !currentState } : a))
    } finally {
      setTogglingId(null)
    }
  }

  async function deleteAutomation(id: string, name: string) {
    if (!confirm(`Delete automation "${name}"? This cannot be undone.`)) return
    setDeletingId(id)
    try {
      await fetch(`/api/automations/${id}`, { method: 'DELETE' })
      setAutomations((prev) => prev.filter((a) => a.id !== id))
    } finally {
      setDeletingId(null)
    }
  }

  return (
    <div className="animate-fade-in">
      <div className="page-header">
        <div>
          <h1 className="page-title gradient-text">Automations</h1>
          <p className="page-subtitle">Manage your keyword → DM automations</p>
        </div>
        <Link href="/automations/new" className="btn btn-primary">+ Create Automation</Link>
      </div>

      {error && <div className="alert alert-error" style={{ marginBottom: '20px' }}>{error}</div>}

      {loading ? (
        <div style={{ display: 'flex', justifyContent: 'center', padding: '64px' }}>
          <div className="spinner" style={{ width: '32px', height: '32px' }} />
        </div>
      ) : automations.length === 0 ? (
        <div className="card">
          <div className="empty-state">
            <div className="empty-state-icon">🤖</div>
            <div className="empty-state-title">No automations yet</div>
            <p style={{ fontSize: '14px', color: 'var(--color-text-muted)', marginBottom: '20px' }}>
              Create your first automation to start converting comments to DMs.
            </p>
            <Link href="/automations/new" className="btn btn-primary">Create your first automation</Link>
          </div>
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
          {automations.map((automation) => (
            <div key={automation.id} className="card" style={{ padding: '20px 24px' }}>
              <div style={{ display: 'flex', alignItems: 'flex-start', gap: '16px', flexWrap: 'wrap' }}>
                {/* Status dot */}
                <div style={{ paddingTop: '2px' }}>
                  <span className={`badge ${automation.is_active ? 'badge-active' : 'badge-inactive'}`}>
                    <span className={`dot ${automation.is_active ? 'dot-pulse' : ''}`} />
                    {automation.is_active ? 'Active' : 'Inactive'}
                  </span>
                </div>

                {/* Details */}
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '10px', flexWrap: 'wrap', marginBottom: '8px' }}>
                    <h3 style={{ fontWeight: 600, fontSize: '16px' }}>{automation.name}</h3>
                    <MatchTypeBadge type={automation.match_type} />
                  </div>
                  <div style={{ display: 'flex', gap: '24px', flexWrap: 'wrap', fontSize: '14px' }}>
                    <div>
                      <span className="text-muted">Keyword: </span>
                      <span style={{ fontWeight: 600, fontFamily: 'monospace', color: 'var(--color-accent-light)' }}>
                        {automation.keyword.toUpperCase()}
                      </span>
                    </div>
                    <div>
                      <span className="text-muted">Post: </span>
                      <span>{automation.media_id ? `ID: ${automation.media_id.slice(-8)}…` : 'Any post/reel'}</span>
                    </div>
                    {automation.button_url && (
                      <div>
                        <span className="text-muted">Link: </span>
                        <span style={{ color: 'var(--color-accent-light)' }}>
                          {automation.button_url.replace('https://', '').slice(0, 30)}…
                        </span>
                      </div>
                    )}
                  </div>
                  <div className="text-muted" style={{ fontSize: '13px', marginTop: '8px', fontStyle: 'italic' }}>
                    &ldquo;{automation.dm_message.slice(0, 80)}{automation.dm_message.length > 80 ? '…' : ''}&rdquo;
                  </div>
                </div>

                {/* Actions */}
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexShrink: 0 }}>
                  <label className="toggle" title={automation.is_active ? 'Deactivate' : 'Activate'}>
                    <input
                      type="checkbox"
                      checked={automation.is_active}
                      onChange={() => toggleActive(automation.id, automation.is_active)}
                      disabled={togglingId === automation.id}
                    />
                    <span className="toggle-slider" />
                  </label>
                  <Link href={`/automations/${automation.id}`} className="btn btn-secondary btn-sm">
                    Edit
                  </Link>
                  <button
                    className="btn btn-danger btn-sm"
                    onClick={() => deleteAutomation(automation.id, automation.name)}
                    disabled={deletingId === automation.id}
                  >
                    {deletingId === automation.id ? '…' : 'Delete'}
                  </button>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
