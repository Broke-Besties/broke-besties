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
    <div className="grid gap-4">
      <div className="grid gap-2">
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
          <div className="mt-2 max-h-48 overflow-y-auto rounded-md border bg-background">
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
                  className="w-full border-b p-3 text-left hover:bg-muted/50 last:border-b-0"
                >
                  <div className="font-medium">{user.name}</div>
                  <div className="text-sm text-muted-foreground">{user.email}</div>
                </button>
              ))
            ) : (
              <div className="p-3 text-center text-sm text-muted-foreground">No members found</div>
            )}
          </div>
        )}
      </div>

      <div className="grid gap-2">
        <Label>Selected Borrower</Label>
        {debtData.borrower ? (
          <div className="rounded-md border bg-muted/50 p-3">
            <div className="flex items-center justify-between">
              <div>
                <div className="font-medium">{debtData.borrower.name}</div>
                <div className="text-sm text-muted-foreground">{debtData.borrower.email}</div>
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
                className="text-sm text-muted-foreground hover:text-foreground"
              >
                Clear
              </button>
            </div>
          </div>
        ) : (
          <div className="rounded-md border border-dashed p-3 text-center text-sm text-muted-foreground">
            No borrower selected
          </div>
        )}
      </div>

      <div className="grid gap-2">
        <Label htmlFor="debtAmount">Amount ($)</Label>
        <Input
          id="debtAmount"
          type="number"
          step="0.01"
          min="0.01"
          required
          value={debtData.amount}
          onChange={(e) => updateField('amount', e.target.value)}
          placeholder="0.00"
        />
      </div>
      <div className="grid gap-2">
        <Label htmlFor="debtDescription">Description (optional)</Label>
        <Textarea
          id="debtDescription"
          value={debtData.description}
          onChange={(e) => updateField('description', e.target.value)}
          rows={3}
          placeholder="What is this debt for?"
        />
      </div>
    </div>
  )
}
