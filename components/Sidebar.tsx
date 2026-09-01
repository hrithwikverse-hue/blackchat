'use client'

import Link from 'next/link'
import { usePathname, useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'

interface NavItem {
  href: string
  label: string
  icon: string
}

const NAV_ITEMS: NavItem[] = [
  { href: '/dashboard', label: 'Dashboard', icon: '⚡' },
  { href: '/automations', label: 'Automations', icon: '🤖' },
  { href: '/activity', label: 'Activity', icon: '📋' },
  { href: '/settings', label: 'Settings', icon: '⚙️' },
]

export default function Sidebar() {
  const pathname = usePathname()
  const router = useRouter()
  const supabase = createClient()

  async function handleSignOut() {
    await supabase.auth.signOut()
    router.push('/login')
    router.refresh()
  }

  return (
    <aside className="sidebar">
      {/* Logo */}
      <div style={{ padding: '4px 4px 20px', marginBottom: '8px' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
          <div style={{
            width: '36px', height: '36px', borderRadius: '10px',
            background: 'linear-gradient(135deg, #7c3aed, #4f46e5)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            fontSize: '18px', flexShrink: 0,
            boxShadow: '0 0 20px rgba(124,58,237,0.4)',
          }}>
            ⚡
          </div>
          <div>
            <div style={{ fontWeight: 700, fontSize: '15px' }}>BlackChat</div>
            <div style={{ fontSize: '11px', color: 'var(--color-text-muted)' }}>Instagram Auto</div>
          </div>
        </div>
      </div>

      <hr className="divider" />

      {/* Navigation */}
      <nav style={{ display: 'flex', flexDirection: 'column', gap: '2px', flex: 1 }}>
        {NAV_ITEMS.map((item) => {
          const isActive = pathname === item.href || (item.href !== '/dashboard' && pathname.startsWith(item.href))
          return (
            <Link
              key={item.href}
              href={item.href}
              className={`sidebar-link ${isActive ? 'active' : ''}`}
            >
              <span style={{ fontSize: '16px' }}>{item.icon}</span>
              {item.label}
            </Link>
          )
        })}
      </nav>

      {/* Bottom */}
      <div style={{ marginTop: 'auto' }}>
        <hr className="divider" />
        <Link href="/automations/new" className="btn btn-primary" style={{ width: '100%', justifyContent: 'center', marginBottom: '8px', fontSize: '13px' }}>
          + New Automation
        </Link>
        <button onClick={handleSignOut} className="btn btn-ghost" style={{ width: '100%', justifyContent: 'center', fontSize: '13px' }}>
          Sign out
        </button>
      </div>
    </aside>
  )
}
