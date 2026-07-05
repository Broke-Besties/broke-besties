'use client'

import { useState, useEffect } from 'react'
import { Search, X } from 'lucide-react'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { searchGroupMembers } from './actions'

type DebtFormData = {
  amount: string
  description: string
  borrowerId: string
  borrower: { id: string; name: string; email: string } | null
  alertMessage: string
  alertDeadline: string
}

type DebtFormItemProps = {
  debtData: DebtFormData
  groupId: number
  currentUserId: string | undefined
  onChange: (data: DebtFormData) => void
}

export function DebtFormItem({ debtData, groupId, currentUserId, onChange }: DebtFormItemProps) {
  const [searchQuery, setSearchQuery] = useState('')
  const [searchResults, setSearchResults] = useState<Array<{ id: string; name: string; email: string }>>([])
  const [searching, setSearching] = useState(false)

  // Debounced search for group members
  useEffect(() => {
    if (!searchQuery.trim()) {
      setSearchResults([])
      return
    }

    const timeoutId = setTimeout(async () => {
      setSearching(true)
      try {
        const result = await searchGroupMembers(groupId, searchQuery)
        if (result.success) {
          const filteredMembers = result.members.filter((member) => member.id !== currentUserId)
          setSearchResults(filteredMembers)
        }
      } catch (error) {
        console.error('Search error:', error)
      } finally {
        setSearching(false)
      }
    }, 300) // 300ms debounce

    return () => clearTimeout(timeoutId)
  }, [searchQuery, groupId, currentUserId])

  const updateField = <K extends keyof DebtFormData>(field: K, value: DebtFormData[K]) => {
    onChange({
      ...debtData,
      [field]: value,
    })
  }

  return (
    <div className="space-y-4">
      <div className="space-y-2">
        <Label htmlFor="borrowerSearch">Search for a member</Label>
        <div className="relative">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            id="borrowerSearch"
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search by name or email..."
            className="pl-9"
            autoComplete="off"
          />
        </div>

        {searchQuery && (
          <div className="max-h-40 overflow-y-auto rounded-lg border bg-background shadow-sm">
            {searching ? (
              <div className="p-3 text-center text-sm text-muted-foreground">Searching...</div>
            ) : searchResults.length > 0 ? (
              searchResults.map((user) => (
                <button
                  key={user.id}
                  type="button"
                  onClick={() => {
                    onChange({
                      ...debtData,
                      borrower: user,
                      borrowerId: user.id,
                    })
                    setSearchQuery('')
                  }}
                  className="w-full border-b p-3 text-left hover:bg-muted/50 transition-colors last:border-b-0"
                >
                  <div className="font-medium text-sm">{user.name}</div>
                  <div className="text-xs text-muted-foreground">{user.email}</div>
                </button>
              ))
            ) : (
              <div className="p-3 text-center text-sm text-muted-foreground">No members found</div>
            )}
          </div>
        )}
      </div>

      {/* Selected Borrower */}
      {debtData.borrower && (
        <div className="space-y-2">
          <Label>Selected Person</Label>
          <div className="rounded-lg border bg-muted/50 p-3">
            <div className="flex items-center justify-between">
              <div>
                <div className="font-medium text-sm">{debtData.borrower.name}</div>
                <div className="text-xs text-muted-foreground">{debtData.borrower.email}</div>
              </div>
              <button
                type="button"
                onClick={() => {
                  onChange({
                    ...debtData,
                    borrower: null,
                    borrowerId: '',
                  })
                }}
                className="p-1 rounded hover:bg-background transition-colors"
              >
                <X className="h-4 w-4 text-muted-foreground" />
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Amount */}
      <div className="space-y-2">
        <Label htmlFor="debtAmount">Amount ($)</Label>
        <Input
          id="debtAmount"
          type="number"
          step="0.01"
          min="0.01"
          value={debtData.amount}
          onChange={(e) => {
            const value = e.target.value
            // Round to 2 decimal places if it's a valid number
            if (value && !isNaN(parseFloat(value))) {
              const rounded = Math.round(parseFloat(value) * 100) / 100
              updateField('amount', rounded.toString())
            } else {
              updateField('amount', value)
            }
          }}
          placeholder="0.00"
        />
      </div>

      {/* Description */}
      <div className="space-y-2">
        <Label htmlFor="debtDescription">Description (optional)</Label>
        <Textarea
          id="debtDescription"
          value={debtData.description}
          onChange={(e) => updateField('description', e.target.value)}
          rows={2}
          placeholder="What is this debt for?"
          className="resize-none"
        />
      </div>

      {/* Alert Section */}
      <div className="space-y-4 pt-4 border-t">
        <Label className="text-base font-medium">Payment Reminder (optional)</Label>
        <div className="space-y-2">
          <Label htmlFor="alertMessage" className="text-sm">Message</Label>
          <Textarea
            id="alertMessage"
            value={debtData.alertMessage}
            onChange={(e) => updateField('alertMessage', e.target.value)}
            rows={2}
            placeholder="e.g., Please pay by end of month"
            className="resize-none"
          />
        </div>
        <div className="space-y-2">
          <Label htmlFor="alertDeadline" className="text-sm">Deadline</Label>
          <Input
            id="alertDeadline"
            type="date"
            value={debtData.alertDeadline}
            onChange={(e) => updateField('alertDeadline', e.target.value)}
          />
        </div>
      </div>
    </div>
  )
}
