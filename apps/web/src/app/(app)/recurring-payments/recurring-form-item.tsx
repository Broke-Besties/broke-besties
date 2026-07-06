'use client'

import { useState, useEffect } from 'react'
import { X, Plus, CircleAlert } from 'lucide-react'
import { toast } from 'sonner'
import type { User } from '@supabase/supabase-js'

import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert'
import { Button } from '@/components/ui/button'
import {
  Field,
  FieldDescription,
  FieldError,
  FieldGroup,
  FieldLabel,
  FieldLegend,
  FieldSeparator,
  FieldSet,
} from '@/components/ui/field'
import { Input } from '@/components/ui/input'
import {
  InputGroup,
  InputGroupAddon,
  InputGroupInput,
  InputGroupText,
} from '@/components/ui/input-group'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetFooter,
  SheetHeader,
  SheetTitle,
} from '@/components/ui/sheet'
import { Spinner } from '@/components/ui/spinner'
import { Textarea } from '@/components/ui/textarea'
import { ToggleGroup, ToggleGroupItem } from '@/components/ui/toggle-group'
import { createRecurringPayment } from './actions'
import type { recurringPaymentService } from '@/services/recurring-payment.service'

type BorrowerFormData = {
  email: string
  splitPercentage: number
  dollarAmount: number
}

type RecurringPayment = Awaited<ReturnType<typeof recurringPaymentService.createRecurringPayment>>

type RecurringFormItemProps = {
  currentUser: User
  isOpen: boolean
  onClose: () => void
  onSuccess: (recurringPayment: RecurringPayment) => void
}

const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/

export default function RecurringFormItem({
  currentUser,
  isOpen,
  onClose,
  onSuccess,
}: RecurringFormItemProps) {
  const [amount, setAmount] = useState('')
  const [description, setDescription] = useState('')
  const [frequency, setFrequency] = useState('30')
  const [isForSelf, setIsForSelf] = useState(false)
  const [borrowers, setBorrowers] = useState<BorrowerFormData[]>([{
    email: '',
    splitPercentage: 100,
    dollarAmount: 0,
  }])
  const [alertMessage, setAlertMessage] = useState('')
  const [alertFrequency, setAlertFrequency] = useState<string>('off')
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState('')

  // Update dollar amounts when total amount changes
  useEffect(() => {
    const totalAmount = parseFloat(amount) || 0
    setBorrowers(prev => prev.map(b => ({
      ...b,
      dollarAmount: Math.round(((b.splitPercentage / 100) * totalAmount) * 100) / 100, // Round to 2 decimal places
    })))
  }, [amount])

  const updateBorrowerPercentage = (index: number, percentage: number) => {
    const totalAmount = parseFloat(amount) || 0
    const dollarAmount = (percentage / 100) * totalAmount

    const updated = [...borrowers]
    updated[index] = {
      ...updated[index],
      splitPercentage: Math.round(percentage * 10000) / 10000, // Round to 4 decimal places
      dollarAmount: Math.round(dollarAmount * 100) / 100, // Round to 2 decimal places
    }
    setBorrowers(updated)
  }

  const updateBorrowerDollar = (index: number, dollarAmount: number) => {
    const totalAmount = parseFloat(amount) || 0
    const percentage = totalAmount > 0 ? (dollarAmount / totalAmount) * 100 : 0

    const updated = [...borrowers]
    updated[index] = {
      ...updated[index],
      splitPercentage: Math.round(percentage * 10000) / 10000, // Round to 4 decimal places
      dollarAmount: Math.round(dollarAmount * 100) / 100, // Round to 2 decimal places
    }
    setBorrowers(updated)
  }

  const addBorrower = () => {
    setBorrowers([...borrowers, {
      email: '',
      splitPercentage: 0,
      dollarAmount: 0,
    }])
  }

  const removeBorrower = (index: number) => {
    if (borrowers.length === 1) return
    setBorrowers(borrowers.filter((_, i) => i !== index))
  }

  const updateBorrowerEmail = (index: number, email: string) => {
    const updated = [...borrowers]
    updated[index] = {
      ...updated[index],
      email: email,
    }
    setBorrowers(updated)
  }

  const splitEvenly = () => {
    const totalAmount = parseFloat(amount) || 0
    const numBorrowers = borrowers.length
    const percentagePerBorrower = numBorrowers > 0 ? 100 / numBorrowers : 0
    const dollarPerBorrower = numBorrowers > 0 ? totalAmount / numBorrowers : 0

    const updated = borrowers.map(borrower => ({
      ...borrower,
      splitPercentage: Math.round(percentagePerBorrower * 10000) / 10000,
      dollarAmount: Math.round(dollarPerBorrower * 100) / 100,
    }))

    setBorrowers(updated)
  }

  const resetForm = () => {
    setAmount('')
    setDescription('')
    setFrequency('30')
    setIsForSelf(false)
    setBorrowers([{
      email: '',
      splitPercentage: 100,
      dollarAmount: 0,
    }])
    setAlertMessage('')
    setAlertFrequency('off')
    setError('')
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError('')

    const parsedAmount = parseFloat(amount)
    const parsedFrequency = parseInt(frequency)

    if (!parsedAmount || parsedAmount <= 0) {
      setError('Please enter a valid amount')
      return
    }

    if (!parsedFrequency || parsedFrequency < 1) {
      setError('Frequency must be at least 1 day')
      return
    }

    const borrowersToSubmit = isForSelf
      ? [{ email: currentUser.email!, splitPercentage: 100 }]
      : borrowers.map(b => ({ email: b.email.trim(), splitPercentage: b.splitPercentage }))

    if (!isForSelf) {
      if (borrowersToSubmit.some(b => !b.email)) {
        setError('Please enter all borrower emails')
        return
      }

      if (borrowersToSubmit.some(b => !EMAIL_REGEX.test(b.email))) {
        setError('Please enter valid email addresses')
        return
      }

      const totalPercentage = borrowersToSubmit.reduce((sum, b) => sum + b.splitPercentage, 0)
      if (Math.abs(totalPercentage - 100) > 0.01) {
        setError(`Split percentages must sum to 100% (currently ${Math.round(totalPercentage * 10000) / 10000}%)`)
        return
      }
    }

    setSubmitting(true)

    try {
      const result = await createRecurringPayment({
        amount: parsedAmount,
        description: description.trim() || undefined,
        frequency: parsedFrequency,
        borrowers: borrowersToSubmit,
      })

      if (result.success) {
        // If alert message or frequency is provided, create an alert for this recurring payment
        const reminderFrequencyDays =
          alertFrequency === 'off' ? null : parseInt(alertFrequency, 10)
        if (alertMessage || reminderFrequencyDays) {
          try {
            const response = await fetch('/api/alerts', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({
                recurringPaymentId: result.recurringPayment.id,
                message: alertMessage || null,
                reminderFrequencyDays,
              }),
            })
            if (!response.ok) {
              throw new Error('Failed to create alert')
            }
          } catch {
            toast.error('Payment created, but the reminder could not be saved')
          }
        }
        toast.success('Recurring payment created')
        onSuccess(result.recurringPayment)
        resetForm()
      } else {
        setError(result.error)
      }
    } catch (error) {
      console.error('Error creating recurring payment:', error)
      setError('An unexpected error occurred')
    } finally {
      setSubmitting(false)
    }
  }

  const handleClose = () => {
    onClose()
    resetForm()
  }

  const totalPercentage = borrowers.reduce((sum, b) => sum + b.splitPercentage, 0)
  const displayPercentage = Math.round(totalPercentage * 10000) / 10000
  const isPercentageValid = Math.abs(totalPercentage - 100) < 0.01
  const allBorrowersValid =
    isForSelf || borrowers.every(b => EMAIL_REGEX.test(b.email.trim()))
  const canSubmit =
    parseFloat(amount) > 0 &&
    parseInt(frequency) >= 1 &&
    allBorrowersValid &&
    (isForSelf || isPercentageValid)

  return (
    <Sheet
      open={isOpen}
      onOpenChange={(open) => {
        if (!open) handleClose()
      }}
    >
      <SheetContent side="right" className="w-full gap-0 sm:max-w-lg">
        <SheetHeader>
          <SheetTitle>Create recurring payment</SheetTitle>
          <SheetDescription>
            Set up a payment that repeats on a fixed cadence and split it with others.
          </SheetDescription>
        </SheetHeader>

        <form onSubmit={handleSubmit} className="flex min-h-0 flex-1 flex-col">
          <div className="flex-1 space-y-6 overflow-y-auto px-4 pb-6">
            {error && (
              <Alert variant="destructive">
                <CircleAlert />
                <AlertTitle>Could not create recurring payment</AlertTitle>
                <AlertDescription>{error}</AlertDescription>
              </Alert>
            )}

            <FieldGroup>
              <Field>
                <FieldLabel htmlFor="recurring-amount">Total amount</FieldLabel>
                <InputGroup>
                  <InputGroupAddon>
                    <InputGroupText>$</InputGroupText>
                  </InputGroupAddon>
                  <InputGroupInput
                    id="recurring-amount"
                    type="number"
                    step="0.01"
                    min="0.01"
                    value={amount}
                    onChange={(e) => setAmount(e.target.value)}
                    placeholder="0.00"
                    required
                  />
                </InputGroup>
              </Field>

              <Field>
                <FieldLabel htmlFor="recurring-description">
                  Description (optional)
                </FieldLabel>
                <Textarea
                  id="recurring-description"
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  placeholder="e.g., Netflix subscription, Utilities, etc."
                  rows={2}
                />
              </Field>

              <Field>
                <FieldLabel htmlFor="recurring-frequency">
                  Frequency (days)
                </FieldLabel>
                <Input
                  id="recurring-frequency"
                  type="number"
                  min="1"
                  value={frequency}
                  onChange={(e) => setFrequency(e.target.value)}
                  placeholder="30"
                  required
                />
                <FieldDescription>
                  How often this payment occurs (e.g., 30 for monthly, 7 for weekly)
                </FieldDescription>
              </Field>

              <Field>
                <FieldLabel id="recurring-payment-type">Payment type</FieldLabel>
                <ToggleGroup
                  type="single"
                  variant="outline"
                  aria-labelledby="recurring-payment-type"
                  value={isForSelf ? 'self' : 'others'}
                  onValueChange={(value) => {
                    if (!value) return
                    const forSelf = value === 'self'
                    setIsForSelf(forSelf)
                    if (forSelf) {
                      setBorrowers([{ email: '', splitPercentage: 100, dollarAmount: 0 }])
                    }
                  }}
                  className="w-full"
                >
                  <ToggleGroupItem value="self" className="flex-1">
                    For myself
                  </ToggleGroupItem>
                  <ToggleGroupItem value="others" className="flex-1">
                    For others
                  </ToggleGroupItem>
                </ToggleGroup>
                <FieldDescription>
                  {isForSelf
                    ? "You'll be both the lender and borrower"
                    : "You'll be the lender, others will be borrowers"}
                </FieldDescription>
              </Field>

              {!isForSelf && (
                <>
                  <FieldSeparator />
                  <FieldSet className="gap-4">
                    <FieldLegend variant="label" className="mb-0">
                      Borrowers
                    </FieldLegend>

                    <div className="flex flex-col gap-4">
                      {borrowers.map((borrower, index) => {
                        const trimmedEmail = borrower.email.trim()
                        const emailInvalid =
                          trimmedEmail !== '' && !EMAIL_REGEX.test(trimmedEmail)

                        return (
                          <div key={index} className="flex items-start gap-2">
                            <Field className="flex-1 gap-1.5" data-invalid={emailInvalid || undefined}>
                              <FieldLabel htmlFor={`borrower-email-${index}`}>
                                Email
                              </FieldLabel>
                              <Input
                                id={`borrower-email-${index}`}
                                type="email"
                                value={borrower.email}
                                onChange={(e) => updateBorrowerEmail(index, e.target.value)}
                                placeholder="user@example.com"
                                aria-invalid={emailInvalid || undefined}
                              />
                              {emailInvalid && (
                                <FieldError>Enter a valid email address</FieldError>
                              )}
                            </Field>
                            <Field className="w-20 shrink-0 gap-1.5">
                              <FieldLabel htmlFor={`borrower-split-${index}`}>
                                Split %
                              </FieldLabel>
                              <Input
                                id={`borrower-split-${index}`}
                                type="number"
                                step="0.0001"
                                min="0"
                                max="100"
                                value={borrower.splitPercentage}
                                onChange={(e) =>
                                  updateBorrowerPercentage(index, parseFloat(e.target.value) || 0)
                                }
                                placeholder="0"
                              />
                            </Field>
                            <Field className="w-28 shrink-0 gap-1.5">
                              <FieldLabel htmlFor={`borrower-dollar-${index}`}>
                                Amount
                              </FieldLabel>
                              <InputGroup>
                                <InputGroupAddon>
                                  <InputGroupText>$</InputGroupText>
                                </InputGroupAddon>
                                <InputGroupInput
                                  id={`borrower-dollar-${index}`}
                                  type="number"
                                  step="0.01"
                                  min="0"
                                  value={borrower.dollarAmount || ''}
                                  onChange={(e) =>
                                    updateBorrowerDollar(index, parseFloat(e.target.value) || 0)
                                  }
                                  placeholder="0"
                                />
                              </InputGroup>
                            </Field>
                            <Button
                              type="button"
                              variant="ghost"
                              size="icon"
                              className="mt-6 shrink-0"
                              onClick={() => removeBorrower(index)}
                              disabled={borrowers.length === 1}
                              aria-label={`Remove borrower ${index + 1}`}
                            >
                              <X />
                            </Button>
                          </div>
                        )
                      })}
                    </div>

                    {isPercentageValid ? (
                      <FieldDescription>Splits total 100%</FieldDescription>
                    ) : (
                      <FieldError>
                        Splits total {displayPercentage}% — they must equal 100%
                      </FieldError>
                    )}

                    <div className="flex items-center gap-2">
                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        onClick={addBorrower}
                      >
                        <Plus />
                        Add borrower
                      </Button>
                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        onClick={splitEvenly}
                        disabled={borrowers.length === 0}
                      >
                        Split evenly
                      </Button>
                    </div>
                  </FieldSet>
                </>
              )}

              <FieldSeparator />

              <FieldSet>
                <FieldLegend variant="label">
                  Payment reminder (optional)
                </FieldLegend>
                <FieldDescription>
                  Set a reminder message for this recurring payment.
                </FieldDescription>
                <Field>
                  <FieldLabel htmlFor="recurring-alert-message">Message</FieldLabel>
                  <Textarea
                    id="recurring-alert-message"
                    value={alertMessage}
                    onChange={(e) => setAlertMessage(e.target.value)}
                    placeholder="e.g., Monthly subscription reminder"
                    rows={2}
                  />
                </Field>
                <Field>
                  <FieldLabel htmlFor="recurringAlertFrequency">
                    Email reminder frequency
                  </FieldLabel>
                  <Select value={alertFrequency} onValueChange={setAlertFrequency}>
                    <SelectTrigger id="recurringAlertFrequency">
                      <SelectValue placeholder="Off" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="off">Off (no email reminders)</SelectItem>
                      <SelectItem value="7">Weekly (every 7 days)</SelectItem>
                      <SelectItem value="14">Biweekly (every 14 days)</SelectItem>
                      <SelectItem value="30">Monthly (every 30 days)</SelectItem>
                    </SelectContent>
                  </Select>
                  <FieldDescription>
                    The borrower receives an email reminder on this cadence.
                  </FieldDescription>
                </Field>
              </FieldSet>
            </FieldGroup>
          </div>

          <SheetFooter className="flex-row justify-end border-t">
            <Button
              type="button"
              variant="secondary"
              onClick={handleClose}
              disabled={submitting}
            >
              Cancel
            </Button>
            <Button type="submit" disabled={!canSubmit || submitting}>
              {submitting && <Spinner />}
              Create recurring payment
            </Button>
          </SheetFooter>
        </form>
      </SheetContent>
    </Sheet>
  )
}
