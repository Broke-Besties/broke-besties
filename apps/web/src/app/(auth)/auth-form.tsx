'use client'

import { useState } from 'react'
import Link from 'next/link'
import { CircleAlert } from 'lucide-react'

import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert'
import { Button } from '@/components/ui/button'
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from '@/components/ui/card'
import {
  Field,
  FieldDescription,
  FieldError,
  FieldGroup,
  FieldLabel,
  FieldSeparator,
} from '@/components/ui/field'
import { Input } from '@/components/ui/input'
import { Spinner } from '@/components/ui/spinner'
import { GoogleIcon } from '@/components/google-icon'
import { createClient } from '@/lib/supabase-client'

type AuthMode = 'login' | 'signup'

const COPY = {
  login: {
    title: 'Welcome back',
    description: 'Log in to manage groups, invites, and debts.',
    endpoint: '/api/auth/login',
    submitLabel: 'Log in',
    errorTitle: 'Could not sign in',
    fallbackError: 'Failed to log in',
    passwordAutoComplete: 'current-password',
    footerPrompt: "Don't have an account?",
    footerLinkLabel: 'Sign up',
    footerLinkHref: '/signup',
  },
  signup: {
    title: 'Create your account',
    description: 'Start creating groups and tracking debts in minutes.',
    endpoint: '/api/auth/signup',
    submitLabel: 'Create account',
    errorTitle: 'Could not sign up',
    fallbackError: 'Failed to sign up',
    passwordAutoComplete: 'new-password',
    footerPrompt: 'Already have an account?',
    footerLinkLabel: 'Log in',
    footerLinkHref: '/login',
  },
} as const satisfies Record<
  AuthMode,
  {
    title: string
    description: string
    endpoint: string
    submitLabel: string
    errorTitle: string
    fallbackError: string
    passwordAutoComplete: string
    footerPrompt: string
    footerLinkLabel: string
    footerLinkHref: string
  }
>

const EMAIL_PATTERN = /^\S+@\S+\.\S+$/
const MIN_PASSWORD_LENGTH = 6

type FieldErrors = { email?: string; password?: string }
type PendingAction = 'google' | 'email' | null

export function AuthForm({ mode }: { mode: AuthMode }) {
  const copy = COPY[mode]

  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')
  const [fieldErrors, setFieldErrors] = useState<FieldErrors>({})
  const [pending, setPending] = useState<PendingAction>(null)

  const validate = () => {
    const errors: FieldErrors = {}

    if (!email.trim()) {
      errors.email = 'Email is required.'
    } else if (!EMAIL_PATTERN.test(email.trim())) {
      errors.email = 'Enter a valid email address.'
    }

    if (!password) {
      errors.password = 'Password is required.'
    } else if (mode === 'signup' && password.length < MIN_PASSWORD_LENGTH) {
      errors.password = `Password must be at least ${MIN_PASSWORD_LENGTH} characters.`
    }

    setFieldErrors(errors)
    return Object.keys(errors).length === 0
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError('')

    if (!validate()) return

    setPending('email')

    try {
      const response = await fetch(copy.endpoint, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ email, password }),
      })

      const data = await response.json()

      if (!response.ok) {
        setError(data.error || copy.fallbackError)
        return
      }

      // Redirect to dashboard and refresh the page
      window.location.href = '/dashboard'
    } catch {
      setError('An error occurred. Please try again.')
    } finally {
      setPending(null)
    }
  }

  const handleGoogle = async () => {
    setError('')
    setFieldErrors({})
    setPending('google')

    try {
      const supabase = createClient()
      const { error } = await supabase.auth.signInWithOAuth({
        provider: 'google',
        options: {
          redirectTo: `${window.location.origin}/api/auth/callback?next=/dashboard`,
        },
      })

      if (error) {
        setError(error.message)
        setPending(null)
      }
      // If successful, user will be redirected to Google
    } catch {
      setError('An error occurred. Please try again.')
      setPending(null)
    }
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>{copy.title}</CardTitle>
        <CardDescription>{copy.description}</CardDescription>
      </CardHeader>
      <CardContent>
        <form onSubmit={handleSubmit} noValidate>
          <FieldGroup>
            {error && (
              <Alert variant="destructive">
                <CircleAlert />
                <AlertTitle>{copy.errorTitle}</AlertTitle>
                <AlertDescription>{error}</AlertDescription>
              </Alert>
            )}

            <Field>
              <Button
                type="button"
                variant="outline"
                onClick={handleGoogle}
                disabled={pending !== null}
              >
                {pending === 'google' ? <Spinner /> : <GoogleIcon />}
                Continue with Google
              </Button>
            </Field>

            <FieldSeparator>Or continue with</FieldSeparator>

            <Field data-invalid={!!fieldErrors.email || undefined}>
              <FieldLabel htmlFor="email">Email</FieldLabel>
              <Input
                id="email"
                type="email"
                value={email}
                onChange={(e) => {
                  setEmail(e.target.value)
                  if (fieldErrors.email) {
                    setFieldErrors((prev) => ({ ...prev, email: undefined }))
                  }
                }}
                placeholder="you@example.com"
                autoComplete="email"
                aria-invalid={!!fieldErrors.email || undefined}
              />
              {fieldErrors.email && <FieldError>{fieldErrors.email}</FieldError>}
            </Field>

            <Field data-invalid={!!fieldErrors.password || undefined}>
              <FieldLabel htmlFor="password">Password</FieldLabel>
              <Input
                id="password"
                type="password"
                value={password}
                onChange={(e) => {
                  setPassword(e.target.value)
                  if (fieldErrors.password) {
                    setFieldErrors((prev) => ({ ...prev, password: undefined }))
                  }
                }}
                autoComplete={copy.passwordAutoComplete}
                aria-invalid={!!fieldErrors.password || undefined}
              />
              {mode === 'signup' && !fieldErrors.password && (
                <FieldDescription>At least 6 characters.</FieldDescription>
              )}
              {fieldErrors.password && (
                <FieldError>{fieldErrors.password}</FieldError>
              )}
            </Field>

            <Field>
              <Button type="submit" disabled={pending !== null}>
                {pending === 'email' && <Spinner />}
                {copy.submitLabel}
              </Button>
            </Field>
          </FieldGroup>
        </form>
      </CardContent>
      <CardFooter>
        <FieldDescription className="w-full text-center">
          {copy.footerPrompt}{' '}
          <Link
            href={copy.footerLinkHref}
            className="underline underline-offset-4"
          >
            {copy.footerLinkLabel}
          </Link>
        </FieldDescription>
      </CardFooter>
    </Card>
  )
}
