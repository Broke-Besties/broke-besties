'use client'

import { useState } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import { useTheme } from 'next-themes'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Separator } from '@/components/ui/separator'
import { updateSettings } from './actions'
import { Moon, Sun, Monitor, Settings, Palette, AlertTriangle } from 'lucide-react'
import { cn } from '@/lib/utils'

type User = {
  id: string
  name: string
  email: string
  createdAt: Date | string
  updatedAt: Date | string
}

type SettingsClientProps = {
  user: User
}

export default function SettingsClient({ user }: SettingsClientProps) {
  const searchParams = useSearchParams()
  const currentTab = searchParams.get('tab') || 'general'

  return (
    <div className="px-6 py-8 md:px-10 max-w-3xl">
      {currentTab === 'general' && <GeneralSection user={user} />}
      {currentTab === 'appearance' && <AppearanceSection />}
      {currentTab === 'danger' && <DangerZoneSection user={user} />}

      {/* Mobile tab navigation */}
      <MobileTabNav currentTab={currentTab} />
    </div>
  )
}

/* ────────────────────────────────────────────
 * Mobile Tab Navigation (visible on small screens)
 * ──────────────────────────────────────────── */
function MobileTabNav({ currentTab }: { currentTab: string }) {
  const tabs = [
    { param: 'general', label: 'General', icon: Settings },
    { param: 'appearance', label: 'Appearance', icon: Palette },
    { param: 'danger', label: 'Danger Zone', icon: AlertTriangle },
  ]

  return (
    <div className="md:hidden fixed bottom-0 left-0 right-0 border-t bg-background/95 backdrop-blur z-50">
      <nav className="flex justify-around py-2">
        {tabs.map((tab) => (
          <a
            key={tab.param}
            href={`/settings?tab=${tab.param}`}
            className={cn(
              'flex flex-col items-center gap-1 px-3 py-1.5 text-xs transition-colors',
              currentTab === tab.param
                ? 'text-foreground font-medium'
                : 'text-muted-foreground'
            )}
          >
            <tab.icon className="size-4" />
            {tab.label}
          </a>
        ))}
      </nav>
    </div>
  )
}

/* ────────────────────────────────────────────
 * General Section
 * ──────────────────────────────────────────── */
function GeneralSection({ user }: { user: User }) {
  const [name, setName] = useState(user.name)
  const [error, setError] = useState('')
  const [success, setSuccess] = useState('')
  const [isLoading, setIsLoading] = useState(false)
  const router = useRouter()

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError('')
    setSuccess('')
    setIsLoading(true)

    try {
      const result = await updateSettings({ name })

      if (!result.success) {
        setError(result.error || 'Failed to update settings')
        return
      }

      setSuccess('Settings updated successfully!')
      router.refresh()
    } catch {
      setError('An error occurred while updating your settings')
    } finally {
      setIsLoading(false)
    }
  }

  return (
    <div className="space-y-8">
      {/* Page heading */}
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">General</h1>
        <p className="text-sm text-muted-foreground mt-1">
          Manage your account profile and preferences.
        </p>
      </div>

      {/* Profile Information */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Profile Information</CardTitle>
          <CardDescription>Update your personal details.</CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit} className="space-y-5">
            {error && (
              <div className="rounded-md border border-destructive/30 bg-destructive/10 px-3 py-2 text-sm text-destructive">
                {error}
              </div>
            )}

            {success && (
              <div className="rounded-md border border-emerald-500/30 bg-emerald-500/10 px-3 py-2 text-sm text-emerald-700 dark:text-emerald-300">
                {success}
              </div>
            )}

            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-2">
                <Label htmlFor="settings-name">Name</Label>
                <Input
                  id="settings-name"
                  type="text"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="Your name"
                  required
                  disabled={isLoading}
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="settings-email">Email</Label>
                <Input
                  id="settings-email"
                  type="email"
                  value={user.email}
                  disabled
                  className="bg-muted"
                />
                <p className="text-xs text-muted-foreground">
                  Email is managed by your auth provider.
                </p>
              </div>
            </div>

            <div className="flex justify-end">
              <Button type="submit" disabled={isLoading} size="sm">
                {isLoading ? 'Saving...' : 'Save'}
              </Button>
            </div>
          </form>
        </CardContent>
      </Card>

      <Separator />

      {/* Account Information */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Account Information</CardTitle>
          <CardDescription>Your account details and metadata.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="flex items-center justify-between py-2">
            <span className="text-sm text-muted-foreground">User ID</span>
            <code className="text-xs font-mono bg-muted px-2 py-1 rounded-md select-all">
              {user.id}
            </code>
          </div>
          <Separator />
          <div className="flex items-center justify-between py-2">
            <span className="text-sm text-muted-foreground">Member since</span>
            <span className="text-sm font-medium">
              {new Date(user.createdAt).toLocaleDateString('en-US', {
                year: 'numeric',
                month: 'long',
                day: 'numeric',
              })}
            </span>
          </div>
          <Separator />
          <div className="flex items-center justify-between py-2">
            <span className="text-sm text-muted-foreground">Last updated</span>
            <span className="text-sm font-medium">
              {new Date(user.updatedAt).toLocaleDateString('en-US', {
                year: 'numeric',
                month: 'long',
                day: 'numeric',
              })}
            </span>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}

/* ────────────────────────────────────────────
 * Appearance Section
 * ──────────────────────────────────────────── */
function AppearanceSection() {
  const { theme, setTheme } = useTheme()

  const themes = [
    {
      id: 'dark',
      label: 'Dark',
      icon: Moon,
      description: 'A dark color scheme that reduces eye strain.',
      preview: 'bg-zinc-900 border-zinc-700',
      previewInner: 'bg-zinc-800',
      previewLine: 'bg-zinc-600',
    },
    {
      id: 'light',
      label: 'Light',
      icon: Sun,
      description: 'A clean, bright color scheme.',
      preview: 'bg-white border-zinc-300',
      previewInner: 'bg-zinc-100',
      previewLine: 'bg-zinc-300',
    },
    {
      id: 'system',
      label: 'System',
      icon: Monitor,
      description: 'Automatically match your OS preference.',
      preview: 'bg-gradient-to-r from-zinc-900 to-white border-zinc-400',
      previewInner: 'bg-gradient-to-r from-zinc-800 to-zinc-100',
      previewLine: 'bg-gradient-to-r from-zinc-600 to-zinc-300',
    },
  ]

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Appearance</h1>
        <p className="text-sm text-muted-foreground mt-1">
          Choose how Broke Besties looks and behaves in the dashboard.
        </p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Theme mode</CardTitle>
          <CardDescription>
            Choose how Broke Besties looks to you. Select a single theme, or sync with your system.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid gap-4 sm:grid-cols-3">
            {themes.map((t) => (
              <button
                key={t.id}
                type="button"
                onClick={() => setTheme(t.id)}
                className={cn(
                  'group relative flex flex-col items-start rounded-lg border-2 p-3 transition-all hover:border-primary/50',
                  theme === t.id
                    ? 'border-primary ring-2 ring-primary/20'
                    : 'border-border hover:bg-muted/50'
                )}
              >
                {/* Theme preview */}
                <div
                  className={cn(
                    'w-full aspect-[16/10] rounded-md border mb-3 p-2 flex flex-col gap-1.5 overflow-hidden',
                    t.preview
                  )}
                >
                  <div className={cn('h-2 w-3/4 rounded-sm', t.previewInner)} />
                  <div className={cn('h-1.5 w-1/2 rounded-sm', t.previewLine)} />
                  <div className={cn('h-1.5 w-2/3 rounded-sm', t.previewLine)} />
                  <div className={cn('flex-1 rounded-sm mt-1', t.previewInner)} />
                </div>

                {/* Label & indicator */}
                <div className="flex items-center gap-2">
                  <div
                    className={cn(
                      'size-3.5 rounded-full border-2 transition-colors',
                      theme === t.id
                        ? 'border-primary bg-primary'
                        : 'border-muted-foreground/40'
                    )}
                  >
                    {theme === t.id && (
                      <div className="size-full rounded-full ring-2 ring-primary ring-offset-1 ring-offset-background" />
                    )}
                  </div>
                  <span className="text-sm font-medium">{t.label}</span>
                </div>
              </button>
            ))}
          </div>
        </CardContent>
      </Card>
    </div>
  )
}

/* ────────────────────────────────────────────
 * Danger Zone Section
 * ──────────────────────────────────────────── */
function DangerZoneSection({ user }: { user: User }) {
  const [showConfirm, setShowConfirm] = useState(false)

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Danger Zone</h1>
        <p className="text-sm text-muted-foreground mt-1">
          Irreversible and destructive actions for your account.
        </p>
      </div>

      <Card className="border-destructive/30">
        <CardHeader>
          <CardTitle className="text-base text-destructive">Delete Account</CardTitle>
          <CardDescription>
            Permanently delete your account and all associated data. This action cannot be undone.
          </CardDescription>
        </CardHeader>
        <CardContent>
          {!showConfirm ? (
            <Button
              variant="destructive"
              size="sm"
              onClick={() => setShowConfirm(true)}
            >
              Delete my account
            </Button>
          ) : (
            <div className="space-y-4">
              <div className="rounded-md border border-destructive/30 bg-destructive/10 px-3 py-3 text-sm">
                <p className="font-medium text-destructive mb-1">Are you sure?</p>
                <p className="text-muted-foreground text-xs">
                  This will permanently delete your account <strong>{user.email}</strong> and
                  remove all of your data including groups, debts, and friends.
                </p>
              </div>
              <div className="flex items-center gap-2">
                <Button
                  variant="destructive"
                  size="sm"
                  disabled
                >
                  Confirm deletion
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setShowConfirm(false)}
                >
                  Cancel
                </Button>
              </div>
              <p className="text-xs text-muted-foreground">
                Account deletion is not yet available. Contact support for assistance.
              </p>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  )
}
