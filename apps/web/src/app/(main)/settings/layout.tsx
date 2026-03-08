import Link from 'next/link'
import { ArrowLeft } from 'lucide-react'
import { SettingsSidebar } from './settings-sidebar'

export default function SettingsLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <div className="min-h-[calc(100vh-3.5rem)]">
      {/* Back link */}
      <div className="border-b border-border">
        <div className="px-4 py-3">
          <Link
            href="/dashboard"
            className="inline-flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground transition-colors"
          >
            <ArrowLeft className="size-4" />
            Back to dashboard
          </Link>
        </div>
      </div>

      {/* Settings layout: sidebar + content */}
      <div className="flex">
        <SettingsSidebar />
        <div className="flex-1 min-w-0">
          {children}
        </div>
      </div>
    </div>
  )
}
