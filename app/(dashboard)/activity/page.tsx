import type { Metadata } from 'next'
import { createServiceRoleClient } from '@/lib/supabase/server'

export const metadata: Metadata = { title: 'Activity Log' }

function formatTime(dateStr: string) {
  return new Date(dateStr).toLocaleString('en-US', {
    month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit', hour12: true
  })
}

export default async function ActivityPage() {
  const db = createServiceRoleClient()

  const [executionsResult, automationsResult] = await Promise.all([
    db.from('automation_executions')
      .select('*')
      .order('created_at', { ascending: false })
      .limit(100),
    db.from('automations').select('id, name'),
  ])

  const executions = executionsResult.data ?? []
  const automations = automationsResult.data ?? []

  const automationMap = new Map(automations.map((a) => [a.id, a.name]))

  const sentCount = executions.filter((e) => e.status === 'sent').length
  const failedCount = executions.filter((e) => e.status === 'failed').length
  const skippedCount = executions.filter((e) => e.status === 'skipped').length

  return (
    <div className="animate-fade-in">
      <div className="page-header">
        <div>
          <h1 className="page-title gradient-text">Activity Log</h1>
          <p className="page-subtitle">Recent automation executions (last 100)</p>
        </div>
      </div>

      {/* Summary badges */}
      <div style={{ display: 'flex', gap: '12px', marginBottom: '24px', flexWrap: 'wrap' }}>
        <span className="badge badge-active" style={{ fontSize: '13px', padding: '6px 14px' }}>
          ✉️ {sentCount} Sent
        </span>
        <span className="badge badge-failed" style={{ fontSize: '13px', padding: '6px 14px' }}>
          ✕ {failedCount} Failed
        </span>
        <span className="badge badge-inactive" style={{ fontSize: '13px', padding: '6px 14px' }}>
          — {skippedCount} Skipped
        </span>
        <span className="badge badge-purple" style={{ fontSize: '13px', padding: '6px 14px' }}>
          Total: {executions.length}
        </span>
      </div>

      <div className="card">
        {executions.length === 0 ? (
          <div className="empty-state">
            <div className="empty-state-icon">📋</div>
            <div className="empty-state-title">No activity yet</div>
            <p className="text-muted" style={{ fontSize: '14px', marginTop: '8px' }}>
              Activity will appear here when someone comments on your posts with a matching keyword.
            </p>
          </div>
        ) : (
          <div className="table-wrap">
            <table>
              <thead>
                <tr>
                  <th>Time</th>
                  <th>Comment ID</th>
                  <th>User ID</th>
                  <th>Automation</th>
                  <th>Status</th>
                  <th>Error</th>
                </tr>
              </thead>
              <tbody>
                {executions.map((exec) => (
                  <tr key={exec.id}>
                    <td className="text-muted" style={{ whiteSpace: 'nowrap', fontSize: '13px' }}>
                      {formatTime(exec.created_at)}
                    </td>
                    <td>
                      <code style={{ fontSize: '12px', color: 'var(--color-text-muted)' }}>
                        {exec.instagram_comment_id}
                      </code>
                    </td>
                    <td>
                      <code style={{ fontSize: '12px', color: 'var(--color-text-muted)' }}>
                        {exec.instagram_user_id ?? '—'}
                      </code>
                    </td>
                    <td style={{ fontWeight: 500 }}>
                      {automationMap.get(exec.automation_id) ?? '—'}
                    </td>
                    <td>
                      {exec.status === 'sent' && <span className="badge badge-success">✓ Sent</span>}
                      {exec.status === 'failed' && <span className="badge badge-failed">✕ Failed</span>}
                      {exec.status === 'skipped' && <span className="badge badge-inactive">— Skipped</span>}
                    </td>
                    <td style={{ maxWidth: '200px' }}>
                      {exec.error ? (
                        <span style={{ fontSize: '12px', color: 'var(--color-red)', wordBreak: 'break-word' }}>
                          {exec.error}
                        </span>
                      ) : '—'}
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
