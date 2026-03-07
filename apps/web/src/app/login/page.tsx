'use client'

import { LoginForm } from '@/components/login-form'

export default function LoginPage() {
  return (
    <div className="flex h-screen w-full items-center justify-center bg-muted p-4">
      <LoginForm className="w-full max-w-sm" />
    </div>
  )
}
