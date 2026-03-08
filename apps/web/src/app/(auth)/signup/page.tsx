'use client'

import { SignupForm } from '@/components/signup-form'
import { AuthLayout } from '@/components/auth/auth-layout'

export default function SignupPage() {
  return (
    <AuthLayout>
      <SignupForm className="w-full" />
    </AuthLayout>
  )
}
