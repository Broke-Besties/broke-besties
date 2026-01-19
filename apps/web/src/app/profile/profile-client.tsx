'use client'

import { useState, useRef } from 'react'
import { useRouter } from 'next/navigation'
import { Camera, Trash2 } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { UserAvatar } from '@/components/user-avatar'
import { updateProfile } from './actions'

type User = {
  id: string
  name: string
  email: string
  profilePictureUrl?: string | null
  createdAt: Date | string
  updatedAt: Date | string
}

type ProfilePageClientProps = {
  user: User
}

export default function ProfilePageClient({ user }: ProfilePageClientProps) {
  const [name, setName] = useState(user.name)
  const [error, setError] = useState('')
  const [success, setSuccess] = useState('')
  const [isLoading, setIsLoading] = useState(false)
  const [avatarError, setAvatarError] = useState('')
  const [avatarSuccess, setAvatarSuccess] = useState('')
  const [isUploadingAvatar, setIsUploadingAvatar] = useState(false)
  const fileInputRef = useRef<HTMLInputElement>(null)
  const router = useRouter()

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError('')
    setSuccess('')
    setIsLoading(true)

    try {
      const result = await updateProfile({ name })

      if (!result.success) {
        setError(result.error || 'Failed to update profile')
        return
      }

      setSuccess('Profile updated successfully!')
      router.refresh()
    } catch (err) {
      setError('An error occurred while updating your profile')
    } finally {
      setIsLoading(false)
    }
  }

  const handleAvatarUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return

    setAvatarError('')
    setAvatarSuccess('')
    setIsUploadingAvatar(true)

    try {
      const formData = new FormData()
      formData.append('file', file)

      const response = await fetch('/api/user/avatar', {
        method: 'POST',
        body: formData,
      })

      const result = await response.json()

      if (!response.ok) {
        setAvatarError(result.error || 'Failed to upload avatar')
        return
      }

      setAvatarSuccess('Profile picture updated!')
      router.refresh()
    } catch (err) {
      setAvatarError('An error occurred while uploading your avatar')
    } finally {
      setIsUploadingAvatar(false)
      // Reset file input
      if (fileInputRef.current) {
        fileInputRef.current.value = ''
      }
    }
  }

  const handleAvatarDelete = async () => {
    setAvatarError('')
    setAvatarSuccess('')
    setIsUploadingAvatar(true)

    try {
      const response = await fetch('/api/user/avatar', {
        method: 'DELETE',
      })

      const result = await response.json()

      if (!response.ok) {
        setAvatarError(result.error || 'Failed to delete avatar')
        return
      }

      setAvatarSuccess('Profile picture removed!')
      router.refresh()
    } catch (err) {
      setAvatarError('An error occurred while deleting your avatar')
    } finally {
      setIsUploadingAvatar(false)
    }
  }

  return (
    <div className="space-y-8">
      <div className="space-y-1">
        <h1 className="text-3xl font-semibold tracking-tight">Profile</h1>
        <p className="text-sm text-muted-foreground">Manage your account settings.</p>
      </div>

      <Card className="max-w-2xl">
        <CardHeader>
          <CardTitle>Profile Picture</CardTitle>
          <CardDescription>Upload a photo to personalize your account.</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            {avatarError && (
              <div className="rounded-md border border-destructive/30 bg-destructive/10 px-3 py-2 text-sm text-destructive">
                {avatarError}
              </div>
            )}

            {avatarSuccess && (
              <div className="rounded-md border border-emerald-500/30 bg-emerald-500/10 px-3 py-2 text-sm text-emerald-700 dark:text-emerald-300">
                {avatarSuccess}
              </div>
            )}

            <div className="flex items-center gap-6">
              <UserAvatar
                name={user.name}
                profilePictureUrl={user.profilePictureUrl}
                size="lg"
              />
              <div className="flex flex-col gap-2">
                <input
                  ref={fileInputRef}
                  type="file"
                  accept="image/jpeg,image/png,image/gif,image/webp"
                  onChange={handleAvatarUpload}
                  className="hidden"
                  disabled={isUploadingAvatar}
                />
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => fileInputRef.current?.click()}
                  disabled={isUploadingAvatar}
                >
                  <Camera className="mr-2 h-4 w-4" />
                  {isUploadingAvatar ? 'Uploading...' : 'Upload Photo'}
                </Button>
                {user.profilePictureUrl && (
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    onClick={handleAvatarDelete}
                    disabled={isUploadingAvatar}
                    className="text-destructive hover:text-destructive"
                  >
                    <Trash2 className="mr-2 h-4 w-4" />
                    Remove
                  </Button>
                )}
                <p className="text-xs text-muted-foreground">
                  JPEG, PNG, GIF, or WebP. Max 10MB.
                </p>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      <Card className="max-w-2xl">
        <CardHeader>
          <CardTitle>Personal Information</CardTitle>
          <CardDescription>Update your profile details below.</CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit} className="space-y-6">
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

            <div className="space-y-2">
              <Label htmlFor="name">Name</Label>
              <Input
                id="name"
                type="text"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="Enter your name"
                required
                disabled={isLoading}
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="email">Email</Label>
              <Input
                id="email"
                type="email"
                value={user.email}
                placeholder="Enter your email"
                disabled
                className="bg-muted"
              />
              <p className="text-xs text-muted-foreground">Email cannot be changed</p>
            </div>

            <div className="flex items-center gap-3">
              <Button type="submit" disabled={isLoading}>
                {isLoading ? 'Saving...' : 'Save Changes'}
              </Button>
              <Button
                type="button"
                variant="outline"
                onClick={() => router.push('/dashboard')}
                disabled={isLoading}
              >
                Cancel
              </Button>
            </div>
          </form>
        </CardContent>
      </Card>

      <Card className="max-w-2xl">
        <CardHeader>
          <CardTitle>Account Information</CardTitle>
          <CardDescription>View your account details.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex items-center justify-between border-b pb-3">
            <span className="text-sm text-muted-foreground">User ID</span>
            <span className="text-sm font-medium">{user.id}</span>
          </div>
          <div className="flex items-center justify-between border-b pb-3">
            <span className="text-sm text-muted-foreground">Member Since</span>
            <span className="text-sm font-medium">
              {new Date(user.createdAt).toLocaleDateString('en-US', { year: 'numeric', month: 'numeric', day: 'numeric' })}
            </span>
          </div>
          <div className="flex items-center justify-between">
            <span className="text-sm text-muted-foreground">Last Updated</span>
            <span className="text-sm font-medium">
              {new Date(user.updatedAt).toLocaleDateString('en-US', { year: 'numeric', month: 'numeric', day: 'numeric' })}
            </span>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}
