'use client'

import Link from 'next/link'
import { usePathname, useSearchParams } from 'next/navigation'
import { cn } from '@/lib/utils'
import { Settings, Palette, AlertTriangle, CreditCard } from 'lucide-react'

const settingsNav = [
  {
    label: 'ACCOUNT SETTINGS',
    items: [
      { href: '/settings', param: 'general', label: 'General', icon: Settings },
      { href: '/settings', param: 'subscription', label: 'Subscription', icon: CreditCard },
      { href: '/settings', param: 'appearance', label: 'Appearance', icon: Palette },
    ],
  },
  {
    label: 'ACCOUNT',
    items: [
      { href: '/settings', param: 'danger', label: 'Danger Zone', icon: AlertTriangle },
    ],
  },
]

export function SettingsSidebar() {
  const pathname = usePathname()
  const searchParams = useSearchParams()
  const currentTab = searchParams.get('tab') || 'general'

  return (
    <aside className="hidden md:flex w-56 shrink-0 flex-col border-r border-border min-h-[calc(100vh-6.5rem)]">
      <div className="px-4 py-6 space-y-6">
        {settingsNav.map((group) => (
          <div key={group.label}>
            <p className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground mb-2 px-2">
              {group.label}
            </p>
            <nav className="space-y-0.5">
              {group.items.map((item) => {
                const isActive = pathname === item.href && currentTab === item.param

                return (
                  <Link
                    key={item.param}
                    href={`${item.href}?tab=${item.param}`}
                    className={cn(
                      'flex items-center gap-2 rounded-md px-2 py-1.5 text-sm transition-colors',
                      isActive
                        ? 'bg-accent text-accent-foreground font-medium'
                        : 'text-muted-foreground hover:text-foreground hover:bg-muted'
                    )}
                  >
                    <item.icon className="size-4" />
                    {item.label}
                  </Link>
                )
              })}
            </nav>
          </div>
        ))}
      </div>
    </aside>
  )
}
