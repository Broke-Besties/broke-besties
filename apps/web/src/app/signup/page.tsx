'use client'

import { SignupForm } from '@/components/signup-form'

export default function SignupPage() {
  return (
    <div className="flex h-screen w-full items-center justify-center bg-muted p-4">
      <SignupForm className="w-full max-w-sm" />
    </div>
  )
}
