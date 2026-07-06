'use client'

import { useEffect, useState } from 'react'
import { Check, ChevronsUpDown } from 'lucide-react'
import { Button } from '@/components/ui/button'
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from '@/components/ui/command'
import { Field, FieldError, FieldLabel } from '@/components/ui/field'
import { Input } from '@/components/ui/input'
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/components/ui/popover'
import { Textarea } from '@/components/ui/textarea'
import { cn } from '@/lib/utils'
import { searchGroupMembers } from './actions'

type MemberOption = { id: string; name: string; email: string }

type DebtFormData = {
  amount: string
  description: string
  borrowerId: string
  borrower: MemberOption | null
  alertMessage: string
  alertDeadline: string
}

export type DebtFormErrors = {
  borrower?: string
  amount?: string
}

type DebtFormItemProps = {
  debtData: DebtFormData
  groupId: number
  currentUserId: string | undefined
  onChange: (data: DebtFormData) => void
  /**
   * When provided, the borrower combobox filters this in-memory list instead
   * of hitting the server. Callers without the member list (e.g. the AI flow)
   * omit it and get the debounced server-search fallback.
   */
  members?: MemberOption[]
  /** Inline validation messages rendered under the relevant fields. */
  errors?: DebtFormErrors
  /** Prefix for element ids so multiple items can stack in one form. */
  idPrefix?: string
}

export function DebtFormItem({
  debtData,
  groupId,
  currentUserId,
  onChange,
  members,
  errors,
  idPrefix = '',
}: DebtFormItemProps) {
  const [pickerOpen, setPickerOpen] = useState(false)
  const [searchQuery, setSearchQuery] = useState('')
  const [searchResults, setSearchResults] = useState<MemberOption[]>([])
  const [searching, setSearching] = useState(false)

  const usingLocalMembers = members !== undefined

  // Server-search fallback, only when no in-memory member list was provided.
  useEffect(() => {
    if (usingLocalMembers || !pickerOpen) return

    const timeoutId = setTimeout(async () => {
      setSearching(true)
      try {
        const result = await searchGroupMembers(groupId, searchQuery)
        if (result.success) {
          setSearchResults(
            result.members.filter((member) => member.id !== currentUserId)
          )
        }
      } catch (error) {
        console.error('Search error:', error)
      } finally {
        setSearching(false)
      }
    }, 300) // 300ms debounce

    return () => clearTimeout(timeoutId)
  }, [usingLocalMembers, pickerOpen, searchQuery, groupId, currentUserId])

  const options = usingLocalMembers
    ? members.filter((member) => member.id !== currentUserId)
    : searchResults

  const updateField = <K extends keyof DebtFormData>(field: K, value: DebtFormData[K]) => {
    onChange({
      ...debtData,
      [field]: value,
    })
  }

  const selectBorrower = (user: MemberOption) => {
    onChange({
      ...debtData,
      borrower: user,
      borrowerId: user.id,
    })
    setPickerOpen(false)
    setSearchQuery('')
  }

  return (
    <div className="space-y-4">
      {/* Borrower combobox */}
      <Field data-invalid={errors?.borrower ? true : undefined}>
        <FieldLabel htmlFor={`${idPrefix}borrower`}>Who owes you?</FieldLabel>
        <Popover open={pickerOpen} onOpenChange={setPickerOpen}>
          <PopoverTrigger asChild>
            <Button
              id={`${idPrefix}borrower`}
              type="button"
              variant="outline"
              role="combobox"
              aria-expanded={pickerOpen}
              aria-invalid={errors?.borrower ? true : undefined}
              className="w-full justify-between font-normal"
            >
              {debtData.borrower ? (
                <span className="truncate">
                  {debtData.borrower.name || debtData.borrower.email}
                </span>
              ) : (
                <span className="text-muted-foreground">Select a member…</span>
              )}
              <ChevronsUpDown className="text-muted-foreground" />
            </Button>
          </PopoverTrigger>
          <PopoverContent className="w-(--radix-popover-trigger-width) p-0" align="start">
            <Command shouldFilter={usingLocalMembers}>
              <CommandInput
                placeholder="Search by name or email…"
                value={searchQuery}
                onValueChange={setSearchQuery}
              />
              <CommandList>
                <CommandEmpty>
                  {searching ? 'Searching…' : 'No members found.'}
                </CommandEmpty>
                <CommandGroup>
                  {options.map((user) => (
                    <CommandItem
                      key={user.id}
                      value={`${user.name} ${user.email}`}
                      onSelect={() => selectBorrower(user)}
                    >
                      <Check
                        className={cn(
                          debtData.borrowerId === user.id
                            ? 'opacity-100'
                            : 'opacity-0'
                        )}
                      />
                      <div className="min-w-0">
                        <div className="truncate text-sm font-medium">{user.name}</div>
                        <div className="truncate text-xs text-muted-foreground">
                          {user.email}
                        </div>
                      </div>
                    </CommandItem>
                  ))}
                </CommandGroup>
              </CommandList>
            </Command>
          </PopoverContent>
        </Popover>
        {errors?.borrower && <FieldError>{errors.borrower}</FieldError>}
      </Field>

      {/* Amount */}
      <Field data-invalid={errors?.amount ? true : undefined}>
        <FieldLabel htmlFor={`${idPrefix}debtAmount`}>Amount ($)</FieldLabel>
        <Input
          id={`${idPrefix}debtAmount`}
          type="number"
          step="0.01"
          min="0.01"
          value={debtData.amount}
          aria-invalid={errors?.amount ? true : undefined}
          onChange={(e) => updateField('amount', e.target.value)}
          placeholder="0.00"
        />
        {errors?.amount && <FieldError>{errors.amount}</FieldError>}
      </Field>

      {/* Description */}
      <Field>
        <FieldLabel htmlFor={`${idPrefix}debtDescription`}>
          Description (optional)
        </FieldLabel>
        <Textarea
          id={`${idPrefix}debtDescription`}
          value={debtData.description}
          onChange={(e) => updateField('description', e.target.value)}
          rows={2}
          placeholder="What is this debt for?"
          className="resize-none"
        />
      </Field>

      {/* Reminder */}
      <div className="space-y-4 border-t pt-4">
        <div className="text-sm font-medium">Payment reminder (optional)</div>
        <Field>
          <FieldLabel htmlFor={`${idPrefix}alertMessage`}>Message</FieldLabel>
          <Textarea
            id={`${idPrefix}alertMessage`}
            value={debtData.alertMessage}
            onChange={(e) => updateField('alertMessage', e.target.value)}
            rows={2}
            placeholder="e.g., Please pay by end of month"
            className="resize-none"
          />
        </Field>
        <Field>
          <FieldLabel htmlFor={`${idPrefix}alertDeadline`}>Deadline</FieldLabel>
          <Input
            id={`${idPrefix}alertDeadline`}
            type="date"
            value={debtData.alertDeadline}
            onChange={(e) => updateField('alertDeadline', e.target.value)}
          />
        </Field>
      </div>
    </div>
  )
}
