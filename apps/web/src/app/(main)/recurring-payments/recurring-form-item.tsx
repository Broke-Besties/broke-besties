'use client'

import { useState, useEffect } from 'react'
import { X, Plus } from 'lucide-react'
import type { User } from '@supabase/supabase-js'

import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import { DialogContent, DialogFooter, DialogHeader, DialogOverlay, DialogTitle } from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { createRecurringPayment } from './actions'
import { recurringPaymentService } from '@/services/recurring-payment.service'

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

      // Basic email validation
      const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
      if (borrowersToSubmit.some(b => !emailRegex.test(b.email))) {
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
        // If alert message is provided, create an alert for this recurring payment
        if (alertMessage) {
          try {
            await fetch('/api/alerts', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({
                recurringPaymentId: result.recurringPayment.id,
                message: alertMessage || null,
              }),
            })
          } catch (alertError) {
            console.error('Failed to create alert:', alertError)
            // Don't fail the whole operation if alert creation fails
          }
        }
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
  const isPercentageValid = Math.abs(totalPercentage - 100) < 0.01
  const allBorrowersSelected = isForSelf || borrowers.every(b => b.email)
  const canSubmit = parseFloat(amount) > 0 && parseInt(frequency) >= 1 && allBorrowersSelected && (isForSelf || isPercentageValid)

  if (!isOpen) return null

  return (
    <div className="fixed inset-0 z-50">
      <DialogOverlay />
      <DialogContent className="max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Create Recurring Payment</DialogTitle>
        </DialogHeader>
        <div className="px-6 pb-6">
          {error && (
            <div className="mb-4 rounded-md border border-destructive/30 bg-destructive/10 px-3 py-2 text-sm text-destructive">
              {error}
            </div>
          )}

          <form onSubmit={handleSubmit} className="grid gap-6">
            <div className="grid gap-3">
              <Label htmlFor="amount">Total Amount ($)</Label>
              <Input
                id="amount"
                type="number"
                step="0.01"
                min="0.01"
                value={amount}
                onChange={(e) => setAmount(e.target.value)}
                placeholder="0"
                required
              />
            </div>

            <div className="grid gap-3">
              <Label htmlFor="description">Description (optional)</Label>
              <Textarea
                id="description"
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                placeholder="e.g., Netflix subscription, Utilities, etc."
                rows={2}
              />
            </div>

            <div className="grid gap-3">
              <Label htmlFor="frequency">Frequency (days)</Label>
              <Input
                id="frequency"
                type="number"
                min="1"
                value={frequency}
                onChange={(e) => setFrequency(e.target.value)}
                placeholder="30"
                required
              />
              <p className="text-xs text-muted-foreground">
                How often this payment occurs (e.g., 30 for monthly, 7 for weekly)
              </p>
            </div>

            <div className="grid gap-3">
              <Label>Payment Type</Label>
              <div className="flex gap-2">
                <Button
                  type="button"
                  variant={isForSelf ? "default" : "outline"}
                  onClick={() => {
                    setIsForSelf(true)
                    setBorrowers([{ email: '', splitPercentage: 100, dollarAmount: 0 }])
                  }}
                  className="flex-1"
                >
                  For Myself
                </Button>
                <Button
                  type="button"
                  variant={!isForSelf ? "default" : "outline"}
                  onClick={() => setIsForSelf(false)}
                  className="flex-1"
                >
                  For Others
                </Button>
              </div>
              <p className="text-xs text-muted-foreground">
                {isForSelf
                  ? "You'll be both the lender and borrower"
                  : "You'll be the lender, others will be borrowers"}
              </p>
            </div>

            {/* Alert Section */}
            <div className="grid gap-3 pt-4 border-t">
              <Label>Payment Reminder (optional)</Label>
              <Textarea
                value={alertMessage}
                onChange={(e) => setAlertMessage(e.target.value)}
                placeholder="e.g., Monthly subscription reminder"
                rows={2}
              />
              <p className="text-xs text-muted-foreground">
                Set a reminder message for this recurring payment
              </p>
            </div>

            {!isForSelf && (
              <div className="grid gap-4">
                <div className="flex items-center justify-between">
                  <Label>Borrowers</Label>
                  <div className={`text-sm ${isPercentageValid ? 'text-emerald-600 dark:text-emerald-400' : 'text-destructive'}`}>
                    Total: {Math.round(totalPercentage * 10000) / 10000}% {isPercentageValid ? '✓' : '(must be 100%)'}
                  </div>
                </div>

                <Button
                  type="button"
                  variant="outline"
                  onClick={splitEvenly}
                  className="w-full"
                  disabled={borrowers.length === 0}
                >
                  Split Evenly
                </Button>

                <div className="grid gap-4">
                  {borrowers.map((borrower, index) => (
                    <Card key={index} className="border-2">
                      <CardContent className="p-4 space-y-4">
                        <div className="flex items-center justify-between">
                          <span className="text-sm font-medium">Borrower {index + 1}</span>
                          {borrowers.length > 1 && (
                            <Button
                              type="button"
                              variant="ghost"
                              size="sm"
                              onClick={() => removeBorrower(index)}
                            >
                              <X className="h-4 w-4" />
                            </Button>
                          )}
                        </div>

                        <div className="grid gap-2">
                          <Label>Email</Label>
                          <Input
                            type="email"
                            value={borrower.email}
                            onChange={(e) => updateBorrowerEmail(index, e.target.value)}
                            placeholder="user@example.com"
                          />
                        </div>

                        <div className="grid grid-cols-2 gap-4">
                          <div className="grid gap-2">
                            <Label>Split %</Label>
                            <Input
                              type="number"
                              step="0.0001"
                              min="0"
                              max="100"
                              value={borrower.splitPercentage}
                              onChange={(e) => updateBorrowerPercentage(index, parseFloat(e.target.value) || 0)}
                              placeholder="0"
                            />
                          </div>
                          <div className="grid gap-2">
                            <Label>Dollar ($)</Label>
                            <Input
                              type="number"
                              step="0.01"
                              min="0"
                              value={borrower.dollarAmount || ''}
                              onChange={(e) => updateBorrowerDollar(index, parseFloat(e.target.value) || 0)}
                              placeholder="0"
                            />
                          </div>
                        </div>
                      </CardContent>
                    </Card>
                  ))}
                </div>

                <Button
                  type="button"
                  variant="outline"
                  onClick={addBorrower}
                  className="w-full"
                >
                  <Plus className="h-4 w-4 mr-2" />
                  Add Borrower
                </Button>
              </div>
            )}

            <DialogFooter>
              <Button
                type="button"
                variant="secondary"
                onClick={handleClose}
              >
                Cancel
              </Button>
              <Button type="submit" disabled={!canSubmit || submitting}>
                {submitting ? 'Creating...' : 'Create Recurring Payment'}
              </Button>
            </DialogFooter>
          </form>
        </div>
      </DialogContent>
    </div>
  )
}
