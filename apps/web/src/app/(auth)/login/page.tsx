'use client'

import { LoginForm } from '@/components/login-form'
import { AuthLayout } from '@/components/auth/auth-layout'

export default function LoginPage() {
  return (
    <AuthLayout>
      <LoginForm className="w-full" />
    </AuthLayout>
  )
}
