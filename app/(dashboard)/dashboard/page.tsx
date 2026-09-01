import type { Metadata } from 'next'
import { createServiceRoleClient } from '@/lib/supabase/server'
import { createServerClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import Link from 'next/link'

export const metadata: Metadata = { title: 'Dashboard' }

async function getStats() {
  const db = createServiceRoleClient()
  const [automationsResult, executionsResult, accountResult] = await Promise.all([
    db.from('automations').select('id, is_active, name'),
    db.from('automation_executions').select('id, status, created_at, automation_id, instagram_comment_id'),
    db.from('instagram_accounts').select('username, is_connected, token_expires_at').maybeSingle(),
  ])
  const automations = automationsResult.data ?? []
  const executions = executionsResult.data ?? []
  const account = accountResult.data

  const recentExecutions = executions
    .sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime())
    .slice(0, 5)
    .map((e) => ({
      ...e,
      automation_name: automations.find((a) => a.id === e.automation_id)?.name ?? 'Unknown',
    }))

  return {
    totalAutomations: automations.length,
    activeAutomations: automations.filter((a) => a.is_active).length,
    commentsProcessed: executions.length,
    dmsSent: executions.filter((e) => e.status === 'sent').length,
    dmsFailed: executions.filter((e) => e.status === 'failed').length,
    recentExecutions,
    account,
  }
}

function formatRelativeTime(dateStr: string): string {
  const date = new Date(dateStr)
  const now = new Date()
  const diff = (now.getTime() - date.getTime()) / 1000
  if (diff < 60) return 'just now'
  if (diff < 3600) return `${Math.floor(diff / 60)}m ago`
  if (diff < 86400) return `${Math.floor(diff / 3600)}h ago`
  return `${Math.floor(diff / 86400)}d ago`
}

export default async function DashboardPage() {
  const supabase = await createServerClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const stats = await getStats()
  const account = stats.account
  const isConnected = account?.is_connected
  const isTokenExpired = account?.token_expires_at
    ? new Date(account.token_expires_at) < new Date()
    : false

  return (
    <div className="animate-fade-in">
      {/* Header */}
      <div className="page-header">
        <div>
          <h1 className="page-title gradient-text">Dashboard</h1>
          <p className="page-subtitle">Your Instagram automation hub</p>
        </div>
        <Link href="/automations/new" className="btn btn-primary">
          + Create Automation
        </Link>
      </div>

      {/* Connection Status */}
      <div className="card" style={{ marginBottom: '24px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '12px' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
          <div style={{
            width: '48px', height: '48px', borderRadius: '12px',
            background: 'linear-gradient(135deg, #f09433 0%, #e6683c 25%, #dc2743 50%, #cc2366 75%, #bc1888 100%)',
            display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '22px',
          }}>📷</div>
          <div>
            <div style={{ fontSize: '14px', color: 'var(--color-text-muted)', marginBottom: '4px' }}>Instagram Account</div>
            {isConnected && !isTokenExpired ? (
              <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                <span style={{ fontWeight: 600, fontSize: '16px' }}>@{account?.username}</span>
                <span className="badge badge-active">
                  <span className="dot dot-pulse" /> Connected
                </span>
              </div>
            ) : isTokenExpired ? (
              <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                <span style={{ fontWeight: 600, fontSize: '16px' }}>@{account?.username}</span>
                <span className="badge badge-pending">⚠ Token Expired</span>
              </div>
            ) : (
              <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                <span style={{ color: 'var(--color-text-muted)' }}>Not connected</span>
                <span className="badge badge-inactive">Disconnected</span>
              </div>
            )}
          </div>
        </div>
        <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
          {isConnected && !isTokenExpired ? (
            <Link href="/settings" className="btn btn-secondary btn-sm">Manage Connection</Link>
          ) : (
            <a href="/api/instagram/connect" className="btn btn-primary btn-sm">
              {isTokenExpired ? '🔄 Reconnect Instagram' : '🔗 Connect Instagram'}
            </a>
          )}
          <Link href="/settings" className="btn btn-ghost btn-sm">Settings</Link>
        </div>
      </div>

      {/* Warning: Token Expiry */}
      {isTokenExpired && (
        <div className="alert alert-warning" style={{ marginBottom: '24px' }}>
          <span>⚠️</span>
          <div>
            <strong>Token Expired</strong> — Your Instagram access token has expired. Automations will not work until you reconnect.
            <a href="/api/instagram/connect" style={{ color: 'var(--color-yellow)', marginLeft: '8px', fontWeight: 600 }}>Reconnect →</a>
          </div>
        </div>
      )}

      {/* Stats Grid */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: '16px', marginBottom: '28px' }}>
        {[
          { label: 'Total Automations', value: stats.totalAutomations, icon: '🤖' },
          { label: 'Active Automations', value: stats.activeAutomations, icon: '✅' },
          { label: 'Comments Matched', value: stats.commentsProcessed, icon: '💬' },
          { label: 'DMs Sent', value: stats.dmsSent, icon: '✉️' },
          { label: 'DM Failures', value: stats.dmsFailed, icon: '❌' },
        ].map((stat) => (
          <div key={stat.label} className="stat-card">
            <div style={{ fontSize: '22px' }}>{stat.icon}</div>
            <div className="stat-value">{stat.value}</div>
            <div className="stat-label">{stat.label}</div>
          </div>
        ))}
      </div>

      {/* Recent Activity */}
      <div className="card">
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '20px' }}>
          <h2 style={{ fontSize: '16px', fontWeight: 600 }}>Recent Activity</h2>
          <Link href="/activity" className="btn btn-ghost btn-sm">View all →</Link>
        </div>

        {stats.recentExecutions.length === 0 ? (
          <div className="empty-state" style={{ padding: '40px' }}>
            <div className="empty-state-icon">💬</div>
            <div className="empty-state-title">No activity yet</div>
            <p style={{ fontSize: '14px', marginTop: '8px' }}>
              Create an automation and wait for comments to start coming in.
            </p>
          </div>
        ) : (
          <div className="table-wrap">
            <table>
              <thead>
                <tr>
                  <th>Time</th>
                  <th>Comment ID</th>
                  <th>Automation</th>
                  <th>Status</th>
                </tr>
              </thead>
              <tbody>
                {stats.recentExecutions.map((exec) => (
                  <tr key={exec.id}>
                    <td className="text-muted" style={{ whiteSpace: 'nowrap' }}>{formatRelativeTime(exec.created_at)}</td>
                    <td>
                      <code style={{ fontSize: '12px', color: 'var(--color-text-muted)' }}>
                        {exec.instagram_comment_id.slice(-10)}…
                      </code>
                    </td>
                    <td style={{ fontWeight: 500 }}>{exec.automation_name}</td>
                    <td>
                      {exec.status === 'sent' && <span className="badge badge-success">✓ Sent</span>}
                      {exec.status === 'failed' && <span className="badge badge-failed">✕ Failed</span>}
                      {exec.status === 'skipped' && <span className="badge badge-inactive">— Skipped</span>}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Quick Actions */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px', marginTop: '20px' }}>
        <Link href="/automations/new" className="card" style={{ display: 'block', textDecoration: 'none', cursor: 'pointer' }}>
          <div style={{ fontSize: '28px', marginBottom: '12px' }}>⚡</div>
          <div style={{ fontWeight: 600, marginBottom: '4px' }}>Create Automation</div>
          <div className="text-muted" style={{ fontSize: '13px' }}>Set up a new keyword → DM flow</div>
        </Link>
        <Link href="/settings" className="card" style={{ display: 'block', textDecoration: 'none', cursor: 'pointer' }}>
          <div style={{ fontSize: '28px', marginBottom: '12px' }}>🔧</div>
          <div style={{ fontWeight: 600, marginBottom: '4px' }}>Webhook Settings</div>
          <div className="text-muted" style={{ fontSize: '13px' }}>Test & configure your webhook URL</div>
        </Link>
      </div>
    </div>
  )
}
