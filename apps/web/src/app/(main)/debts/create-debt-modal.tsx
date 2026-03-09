'use client'

import { useState, useEffect } from 'react'
import { Check, ChevronsUpDown, CalendarIcon } from 'lucide-react'
import { format } from 'date-fns'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from '@/components/ui/dialog'
import {
  Form,
  FormControl,
  FormDescription,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from '@/components/ui/form'
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/components/ui/popover'
import { Calendar } from '@/components/ui/calendar'
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from '@/components/ui/command'

import { zodResolver } from '@hookform/resolvers/zod'
import { useForm } from 'react-hook-form'
import * as z from 'zod'

import { cn } from '@/lib/utils'
import { createStandaloneDebt, searchFriendsForDebt, getRecentFriendsForDebt, getUserGroups } from './actions'

import type { User, Group as PrismaGroup } from '@prisma/client'

type Friend = Pick<User, 'id' | 'name' | 'email'>
type Group = Pick<PrismaGroup, 'id' | 'name'>

type CreateDebtModalProps = {
  isOpen: boolean
  onClose: () => void
  onSuccess: () => void
  currentUserId: string
}

const formSchema = z.object({
  borrower: z.object({
      id: z.string(),
      name: z.string(),
      email: z.string(),
    })
    .nullable()
    .refine((val) => val !== null, { message: 'Please select a friend.' }),
  amount: z.string().refine((val) => !isNaN(parseFloat(val)) && parseFloat(val) > 0, {
    message: 'Enter a valid amount greater than 0',
  }),
  description: z.string().optional(),
  groupId: z.string().optional(),
  alertMessage: z.string().optional(),
  alertDeadline: z.date().optional(),
})

export function CreateDebtModal({ isOpen, onClose, onSuccess, currentUserId }: CreateDebtModalProps) {
  const [groups, setGroups] = useState<Group[]>([])

  // Receipt fields remain in local state for convenience with File preview
  const [receiptFile, setReceiptFile] = useState<File | null>(null)
  const [receiptPreview, setReceiptPreview] = useState<string | null>(null)
  const [uploadingReceipt, setUploadingReceipt] = useState(false)

  const [searchQuery, setSearchQuery] = useState('')
  const [searchResults, setSearchResults] = useState<Friend[]>([])
  const [recentFriends, setRecentFriends] = useState<Friend[]>([])
  const [searching, setSearching] = useState(false)
  const [comboboxOpen, setComboboxOpen] = useState(false)
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState('')

  const form = useForm<z.infer<typeof formSchema>>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      borrower: null,
      amount: '',
      description: '',
      groupId: 'none',
      alertMessage: '',
      alertDeadline: undefined,
    },
  })

  // Load recent friends and groups when modal opens
  useEffect(() => {
    if (isOpen) {
      getRecentFriendsForDebt().then((result) => {
        if (result.success) {
          setRecentFriends(result.friends.filter((f) => f.id !== currentUserId))
        }
      })
      getUserGroups().then((result) => {
        if (result.success) {
          setGroups(result.groups)
        }
      })
    }
  }, [isOpen, currentUserId])

  // Debounced search for friends
  useEffect(() => {
    if (!searchQuery.trim()) {
      setSearchResults([])
      return
    }

    const timeoutId = setTimeout(async () => {
      setSearching(true)
      try {
        const result = await searchFriendsForDebt(searchQuery)
        if (result.success) {
          const filtered = result.friends.filter((f) => f.id !== currentUserId)
          setSearchResults(filtered)
        }
      } catch (error) {
        console.error('Search error:', error)
      } finally {
        setSearching(false)
      }
    }, 300)

    return () => clearTimeout(timeoutId)
  }, [searchQuery, currentUserId])

  const handleReceiptFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return

    const validTypes = ['image/jpeg', 'image/jpg', 'image/png', 'image/webp']
    if (!validTypes.includes(file.type)) {
      setError('Invalid file type. Only JPEG, PNG, and WebP are allowed')
      return
    }

    if (file.size > 10 * 1024 * 1024) {
      setError('File too large. Maximum size is 10MB')
      return
    }

    setReceiptFile(file)
    const reader = new FileReader()
    reader.onloadend = () => {
      setReceiptPreview(reader.result as string)
    }
    reader.readAsDataURL(file)
    setError('')
  }

  const onSubmit = async (values: z.infer<typeof formSchema>) => {
    setSubmitting(true)
    setError('')

    try {
      // Upload receipt if there is one
      let receiptId: string | undefined
      if (receiptFile) {
        setUploadingReceipt(true)
        const formData = new FormData()
        formData.append('file', receiptFile)

        // If there's a group, associate receipt with the group
        if (values.groupId && values.groupId !== 'none') {
          formData.append('groupId', values.groupId)
        }

        const uploadResponse = await fetch('/api/receipts/upload', {
          method: 'POST',
          body: formData,
        })

        if (!uploadResponse.ok) {
          const errorData = await uploadResponse.json()
          throw new Error(errorData.error || 'Failed to upload receipt')
        }

        const uploadData = await uploadResponse.json()
        receiptId = uploadData.data.id
        setUploadingReceipt(false)
      }

      const parsedAmount = Math.round(parseFloat(values.amount) * 100) / 100

      const result = await createStandaloneDebt({
        amount: parsedAmount,
        description: values.description || undefined,
        borrowerId: values.borrower!.id,
        groupId: values.groupId && values.groupId !== 'none' ? parseInt(values.groupId) : undefined,
        receiptIds: receiptId ? [receiptId] : undefined,
      })

      if (result.success && result.debt) {
        // If alert fields are provided, create an alert for this debt
        if (values.alertMessage || values.alertDeadline) {
          try {
            await fetch('/api/alerts', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({
                debtId: result.debt.id,
                message: values.alertMessage || null,
                deadline: values.alertDeadline ? format(values.alertDeadline, 'yyyy-MM-dd') : null,
              }),
            })
          } catch (alertError) {
            console.error('Failed to create alert:', alertError)
          }
        }
        onSuccess()
        handleClose()
      } else {
        setError(result.error || 'Failed to create debt')
      }
    } catch {
      setError('An error occurred while creating the debt')
    } finally {
      setSubmitting(false)
    }
  }

  const handleClose = () => {
    form.reset()
    setReceiptFile(null)
    setReceiptPreview(null)
    setSearchQuery('')
    setSearchResults([])
    setError('')
    onClose()
  }

  const displayFriends = searchQuery.trim() ? searchResults : recentFriends

  return (
    <Dialog open={isOpen} onOpenChange={(open) => !open && handleClose()}>
      <DialogContent className="max-h-[90vh] flex flex-col p-0 sm:max-w-xl overflow-hidden">
        <div className="p-6 pb-2">
          <DialogHeader>
            <DialogTitle>Add New Debt</DialogTitle>
            <DialogDescription className="text-sm">
              Create a debt with a friend. They will owe you this amount.
            </DialogDescription>
          </DialogHeader>
        </div>

        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="flex flex-col flex-1 overflow-hidden">
            <div className="flex-1 overflow-y-auto px-6 py-2 space-y-6">
              {error && (
              <div className="rounded-md border border-destructive/30 bg-destructive/10 px-3 py-2 text-sm text-destructive">
                {error}
              </div>
            )}

            {/* Friend Search (Borrower) */}
            <FormField
              control={form.control}
              name="borrower"
              render={({ field }) => (
                <FormItem className="flex flex-col">
                  <FormLabel>Who owes you?</FormLabel>
                  <Popover open={comboboxOpen} onOpenChange={setComboboxOpen}>
                    <PopoverTrigger asChild>
                      <FormControl>
                        <Button
                          variant="outline"
                          role="combobox"
                          aria-expanded={comboboxOpen}
                          className={cn(
                            "w-full justify-between font-normal",
                            !field.value && "text-muted-foreground"
                          )}
                        >
                          {field.value ? field.value.name : "Select a friend..."}
                          <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
                        </Button>
                      </FormControl>
                    </PopoverTrigger>
                    {/* align="start" causes layout shifts if the button moves, ensure it fits. modal requires care. */}
                    <PopoverContent className="w-[--radix-popover-trigger-width] p-0" align="start">
                      <Command shouldFilter={false}>
                        <CommandInput
                          placeholder="Search friends by name or email..."
                          value={searchQuery}
                          onValueChange={setSearchQuery}
                        />
                        <CommandList>
                          <CommandEmpty>
                            {searching ? "Searching..." : "No friends found."}
                          </CommandEmpty>
                          {displayFriends.length > 0 && (
                            <CommandGroup heading={searchQuery.trim() ? "Search Results" : "Recent Friends"}>
                              {displayFriends.map((friend) => (
                                <CommandItem
                                  key={friend.id}
                                  value={friend.id}
                                  onSelect={() => {
                                    field.onChange(friend)
                                    setComboboxOpen(false)
                                  }}
                                  className="flex flex-col items-start gap-1 cursor-pointer"
                                >
                                  <div className="flex items-center w-full justify-between">
                                    <span className="font-medium text-sm">{friend.name}</span>
                                    <Check
                                      className={cn(
                                        "h-4 w-4",
                                        field.value?.id === friend.id ? "opacity-100" : "opacity-0"
                                      )}
                                    />
                                  </div>
                                  <span className="text-xs text-muted-foreground">{friend.email}</span>
                                </CommandItem>
                              ))}
                            </CommandGroup>
                          )}
                        </CommandList>
                      </Command>
                    </PopoverContent>
                  </Popover>
                  <FormMessage />
                </FormItem>
              )}
            />

            {/* Amount */}
            <FormField
              control={form.control}
              name="amount"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Amount ($)</FormLabel>
                  <FormControl>
                    <Input
                      type="number"
                      step="0.01"
                      placeholder="0.00"
                      className="font-mono"
                      {...field}
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            {/* Description */}
            <FormField
              control={form.control}
              name="description"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Description (optional)</FormLabel>
                  <FormControl>
                    <Textarea
                      placeholder="What is this debt for?"
                      className="resize-none"
                      rows={2}
                      {...field}
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            {/* Group Selector */}
            <FormField
              control={form.control}
              name="groupId"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Group (optional)</FormLabel>
                  <Select onValueChange={field.onChange} defaultValue={field.value}>
                    <FormControl>
                      <SelectTrigger>
                        <SelectValue placeholder="Select a group" />
                      </SelectTrigger>
                    </FormControl>
                    <SelectContent>
                      <SelectItem value="none">No group</SelectItem>
                      {groups.map((group) => (
                        <SelectItem key={group.id} value={group.id.toString()}>
                          {group.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <FormDescription>
                    Associate this debt with a group, or leave empty for a personal debt.
                  </FormDescription>
                  <FormMessage />
                </FormItem>
              )}
            />

            {/* Receipt Upload */}
            <div className="space-y-3">
              <FormLabel>Receipt (optional)</FormLabel>
              <Input
                type="file"
                accept="image/jpeg,image/jpg,image/png,image/webp"
                onChange={handleReceiptFileSelect}
                className="cursor-pointer file:h-full file:bg-primary file:text-primary-foreground file:border-0 hover:file:bg-primary/90 file:px-4 file:mr-4 file:rounded-md pt-0 pb-0 pl-0 border"
              />
              {receiptPreview && (
                <div className="mt-2 rounded-md border border-border/40 bg-muted/50 p-2">
                  <img
                    src={receiptPreview}
                    alt="Receipt preview"
                    className="h-32 w-auto object-contain"
                  />
                </div>
              )}
            </div>

            {/* Alert Section */}
            <div className="space-y-4 pt-4 border-t border-border/40">
              <div className="flex flex-col gap-1">
                <FormLabel className="text-sm font-medium">Payment Reminder (optional)</FormLabel>
                <FormDescription>Set an optional deadline and reminder message.</FormDescription>
              </div>
              
              <FormField
                control={form.control}
                name="alertMessage"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel className="text-xs text-muted-foreground font-normal">Message</FormLabel>
                    <FormControl>
                      <Textarea
                        placeholder="e.g., Please pay by end of month"
                        className="resize-none"
                        rows={2}
                        {...field}
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="alertDeadline"
                render={({ field }) => (
                  <FormItem className="flex flex-col">
                    <FormLabel className="text-xs text-muted-foreground font-normal">Deadline</FormLabel>
                    <Popover>
                      <PopoverTrigger asChild>
                        <FormControl>
                          <Button
                            variant={"outline"}
                            className={cn(
                              "w-full sm:w-[240px] pl-3 text-left font-normal",
                              !field.value && "text-muted-foreground"
                            )}
                          >
                            {field.value ? (
                              format(field.value, "PPP")
                            ) : (
                              <span>Pick a date</span>
                            )}
                            <CalendarIcon className="ml-auto h-4 w-4 opacity-50" />
                          </Button>
                        </FormControl>
                      </PopoverTrigger>
                      <PopoverContent className="w-auto p-0" align="start">
                        <Calendar
                          mode="single"
                          selected={field.value}
                          onSelect={field.onChange}
                          disabled={(date) =>
                            date < new Date(new Date().setHours(0, 0, 0, 0))
                          }
                          initialFocus
                        />
                      </PopoverContent>
                    </Popover>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>

            </div>
            <div className="p-6 pt-4 border-t border-border/40 bg-background">
              <DialogFooter>
                <Button type="button" variant="outline" onClick={handleClose} disabled={submitting || uploadingReceipt}>
                  Cancel
                </Button>
                <Button type="submit" disabled={submitting || uploadingReceipt}>
                  {uploadingReceipt ? 'Uploading...' : submitting ? 'Creating...' : 'Create Debt'}
                </Button>
              </DialogFooter>
            </div>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  )
}
