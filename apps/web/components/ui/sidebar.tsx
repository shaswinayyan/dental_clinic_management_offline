'use client'

import Link           from 'next/link'
import { usePathname } from 'next/navigation'
import { UserButton }  from '@clerk/nextjs'
import {
  LayoutDashboard, Users, CalendarDays, FileText,
  Package, BarChart3, Settings, Stethoscope,
} from 'lucide-react'
import { cn } from '@/lib/utils'

const NAV_ITEMS = [
  { href: '/dashboard',  label: 'Dashboard',  icon: LayoutDashboard },
  { href: '/patients',   label: 'Patients',   icon: Users },
  { href: '/scheduler',  label: 'Scheduler',  icon: CalendarDays },
  { href: '/billing',    label: 'Billing',    icon: FileText },
  { href: '/inventory',  label: 'Inventory',  icon: Package },
  { href: '/analytics',  label: 'Analytics',  icon: BarChart3 },
  { href: '/settings',   label: 'Settings',   icon: Settings },
] as const

export function Sidebar() {
  const pathname = usePathname()

  return (
    <aside className="flex flex-col w-[240px] min-h-screen bg-white border-r border-border shrink-0">
      {/* Logo */}
      <div className="flex items-center gap-2 px-4 h-16 border-b border-border">
        <div className="w-8 h-8 rounded-lg bg-brand-600 flex items-center justify-center shrink-0">
          <Stethoscope className="w-4 h-4 text-white" />
        </div>
        <span className="font-semibold text-text-primary text-sm">Vorsa Cloud</span>
      </div>

      {/* Navigation */}
      <nav className="flex-1 px-3 py-4 space-y-0.5">
        {NAV_ITEMS.map(({ href, label, icon: Icon }) => {
          const active = pathname.startsWith(href)
          return (
            <Link
              key={href}
              href={href}
              className={cn(
                'flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-colors',
                active
                  ? 'bg-brand-50 text-brand-700'
                  : 'text-text-secondary hover:bg-surface-muted hover:text-text-primary',
              )}
            >
              <Icon className={cn('w-4 h-4 shrink-0', active ? 'text-brand-600' : 'text-text-muted')} />
              {label}
            </Link>
          )
        })}
      </nav>

      {/* User */}
      <div className="px-4 py-4 border-t border-border">
        <UserButton
          appearance={{
            elements: {
              avatarBox:     'w-8 h-8',
              userButtonBox: 'flex items-center gap-2',
            },
          }}
          showName
        />
      </div>
    </aside>
  )
}
