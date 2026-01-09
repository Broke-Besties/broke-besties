'use client'

import { useState, useEffect } from 'react'
import { Search } from 'lucide-react'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { searchGroupMembers } from './actions'

type DebtFormData = {
  amount: string
  description: string
  borrowerId: string
  borrower: { id: string; name: string; email: string } | null
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
    <div className="grid gap-4 sm:gap-6">
      <div className="grid gap-2 sm:gap-3">
        <Label htmlFor="borrowerSearch" className="text-sm">Search for a member</Label>
        <div className="relative">
          <Search className="absolute left-3 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground" />
          <Input
            id="borrowerSearch"
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search by name or email..."
            className="pl-9 text-sm h-10 min-w-0"
            autoComplete="off"
          />
        </div>

        {searchQuery && (
          <div className="mt-2 max-h-48 overflow-y-auto rounded-lg border bg-background shadow-sm">
            {searching ? (
              <div className="p-2 sm:p-3 text-center text-xs text-muted-foreground">Searching...</div>
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
                  className="w-full border-b p-2 sm:p-3 text-left hover:bg-muted/50 transition-colors last:border-b-0"
                >
                  <div className="font-medium text-sm">{user.name}</div>
                  <div className="text-xs text-muted-foreground">{user.email}</div>
                </button>
              ))
            ) : (
              <div className="p-2 sm:p-3 text-center text-xs text-muted-foreground">No members found</div>
            )}
          </div>
        )}
      </div>

      <div className="grid gap-2 sm:gap-3">
        <Label className="text-sm">Selected Borrower</Label>
        {debtData.borrower ? (
          <div className="rounded-lg border bg-muted/50 p-2 sm:p-3 shadow-sm overflow-hidden">
            <div className="flex items-center gap-2 min-w-0">
              <div className="min-w-0 flex-1 overflow-hidden">
                <div className="font-medium text-sm truncate">{debtData.borrower.name}</div>
                <div className="text-xs text-muted-foreground truncate">{debtData.borrower.email}</div>
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
                className="text-xs text-muted-foreground hover:text-foreground transition-colors flex-shrink-0 px-2 py-1 hover:bg-background rounded whitespace-nowrap"
              >
                Clear
              </button>
            </div>
          </div>
        ) : (
          <div className="rounded-lg border border-dashed p-2 sm:p-3 text-center text-xs text-muted-foreground">
            No borrower selected
          </div>
        )}
      </div>

      <div className="grid gap-2 sm:gap-3">
        <Label htmlFor="debtAmount" className="text-sm">Amount ($)</Label>
        <Input
          id="debtAmount"
          type="number"
          step="0.01"
          min="0.01"
          required
          value={debtData.amount}
          onChange={(e) => updateField('amount', e.target.value)}
          placeholder="0.00"
          className="text-sm h-10 min-w-0"
        />
      </div>
      <div className="grid gap-2 sm:gap-3">
        <Label htmlFor="debtDescription" className="text-sm">Description (optional)</Label>
        <Textarea
          id="debtDescription"
          value={debtData.description}
          onChange={(e) => updateField('description', e.target.value)}
          rows={3}
          placeholder="What is this debt for?"
          className="text-sm resize-none min-w-0"
        />
      </div>
    </div>
  )
}
