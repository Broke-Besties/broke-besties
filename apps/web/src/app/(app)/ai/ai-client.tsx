'use client'

import { useState, useRef, useEffect } from 'react'
import Link from 'next/link'
import { useSearchParams, useRouter } from 'next/navigation'
import { CircleAlert, ImageIcon, Plus, Sparkles, Users, X } from 'lucide-react'
import { toast } from 'sonner'
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import {
  Empty,
  EmptyContent,
  EmptyDescription,
  EmptyHeader,
  EmptyMedia,
  EmptyTitle,
} from '@/components/ui/empty'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { ScrollArea } from '@/components/ui/scroll-area'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { Spinner } from '@/components/ui/spinner'
import { PageHeader } from '@/components/page-header'
import { createDebt } from '@/app/(app)/groups/[id]/actions'
import { ChatMessageBubble, ThinkingBubble, type ChatMessage } from './chat-message'
import {
  ReceiptAssignmentPanel,
  type AssignableItem,
  type GroupMemberOption,
  type ReceiptItemAssignment,
} from './receipt-assignment-panel'

type Group = {
  id: number
  name: string
}

const SUGGESTED_PROMPTS = [
  'Split a $60 dinner evenly between everyone',
  'Add a $15 debt for movie tickets',
  'What can you help me with?',
]

export default function AIPageClient() {
  const searchParams = useSearchParams()
  const [messages, setMessages] = useState<ChatMessage[]>([])
  const [input, setInput] = useState('')
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState('')
  const [groupId, setGroupId] = useState('')
  const [groups, setGroups] = useState<Group[]>([])
  const [isLoadingGroups, setIsLoadingGroups] = useState(true)
  const [pendingImage, setPendingImage] = useState<{ url: string; file: File } | null>(null)
  const [isUploading, setIsUploading] = useState(false)
  const [currentReceiptId, setCurrentReceiptId] = useState<string | null>(null)
  const [parsedItems, setParsedItems] = useState<AssignableItem[] | null>(null)
  const [parsedKey, setParsedKey] = useState(0)
  const [members, setMembers] = useState<GroupMemberOption[]>([])
  const [isCreatingDebts, setIsCreatingDebts] = useState(false)
  const [isParsing, setIsParsing] = useState(false)
  const scrollAreaRef = useRef<HTMLDivElement>(null)
  const fileInputRef = useRef<HTMLInputElement>(null)
  const inputRef = useRef<HTMLInputElement>(null)
  const router = useRouter()

  // Fetch user's groups on mount
  useEffect(() => {
    async function fetchGroups() {
      try {
        const response = await fetch('/api/groups')
        if (!response.ok) {
          throw new Error('Failed to fetch groups')
        }
        const data = await response.json()
        setGroups(data.groups)

        // Check if group is specified in URL params
        const groupParam = searchParams.get('group')
        if (groupParam) {
          setGroupId(groupParam)
        } else if (data.groups.length > 0) {
          // Auto-select first group if no param and groups available
          setGroupId(data.groups[0].id.toString())
        }
      } catch (err) {
        console.error('Error fetching groups:', err)
        setError('Failed to load groups')
      } finally {
        setIsLoadingGroups(false)
      }
    }
    fetchGroups()
  }, [searchParams])

  // Auto-scroll to bottom when messages change
  useEffect(() => {
    const viewport = scrollAreaRef.current?.querySelector(
      '[data-slot="scroll-area-viewport"]'
    )
    if (viewport) {
      viewport.scrollTop = viewport.scrollHeight
    }
  }, [messages, isLoading])

  // Fetch group members whenever the selected group changes
  useEffect(() => {
    if (!groupId) {
      setMembers([])
      return
    }
    let cancelled = false
    async function fetchMembers() {
      try {
        const response = await fetch(`/api/groups/${groupId}`)
        if (!response.ok) {
          throw new Error('Failed to fetch group')
        }
        const data = await response.json()
        if (!cancelled) {
          setMembers(
            (data.group?.members || []).map(
              (member: { user: { id: string; name: string } }) => ({
                id: member.user.id,
                name: member.user.name,
              })
            )
          )
        }
      } catch (err) {
        console.error('Error fetching group members:', err)
      }
    }
    fetchMembers()
    return () => {
      cancelled = true
    }
  }, [groupId])

  // Handle paste events for images
  useEffect(() => {
    const handlePaste = async (e: ClipboardEvent) => {
      if (!groupId) {
        return
      }

      const items = e.clipboardData?.items
      if (!items) return

      for (const item of items) {
        if (item.type.startsWith('image/')) {
          e.preventDefault()
          const file = item.getAsFile()
          if (file) {
            // Inline the validation logic to avoid adding handleImageFile to dependencies
            const validTypes = ['image/jpeg', 'image/jpg', 'image/png', 'image/webp', 'image/gif']
            if (!validTypes.includes(file.type)) {
              setError('Invalid file type. Only JPEG, PNG, WebP, and GIF are allowed')
              return
            }

            if (file.size > 10 * 1024 * 1024) {
              setError('File too large. Maximum size is 10MB')
              return
            }

            const previewUrl = URL.createObjectURL(file)
            setPendingImage({ url: previewUrl, file })
            setError('')
          }
          break
        }
      }
    }

    document.addEventListener('paste', handlePaste)
    return () => document.removeEventListener('paste', handlePaste)
  }, [groupId])

  const handleImageFile = (file: File) => {
    if (!groupId) {
      setError('Please select a group first')
      return
    }

    // Validate file type
    const validTypes = ['image/jpeg', 'image/jpg', 'image/png', 'image/webp', 'image/gif']
    if (!validTypes.includes(file.type)) {
      setError('Invalid file type. Only JPEG, PNG, WebP, and GIF are allowed')
      return
    }

    // Validate file size (10MB max)
    if (file.size > 10 * 1024 * 1024) {
      setError('File too large. Maximum size is 10MB')
      return
    }

    // Create a preview URL
    const previewUrl = URL.createObjectURL(file)
    setPendingImage({ url: previewUrl, file })
    setError('')
  }

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (file) {
      handleImageFile(file)
    }
    // Reset the input so the same file can be selected again
    e.target.value = ''
  }

  const uploadImage = async (file: File): Promise<{ signedUrl: string; receiptId: string }> => {
    const formData = new FormData()
    formData.append('file', file)
    // No debtIds - creating a pending receipt for AI analysis

    const response = await fetch('/api/receipts/upload', {
      method: 'POST',
      body: formData,
    })

    if (!response.ok) {
      const errorData = await response.json()
      throw new Error(errorData.error || 'Failed to upload image')
    }

    const data = await response.json()
    return { signedUrl: data.data.signedUrl, receiptId: data.data.id }
  }

  const linkReceiptToDebts = async (receiptId: string, debtIds: number[]) => {
    const response = await fetch(`/api/receipts/${receiptId}`, {
      method: 'PATCH',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ debtIds }),
    })

    if (!response.ok) {
      const errorData = await response.json()
      throw new Error(errorData.error || 'Failed to link receipt to debts')
    }
  }

  const clearPendingImage = () => {
    if (pendingImage) {
      URL.revokeObjectURL(pendingImage.url)
      setPendingImage(null)
    }
    // Don't clear currentReceiptId here, need it later to create debts
  }

  const deleteCurrentReceipt = async () => {
    if (currentReceiptId) {
      try {
        await fetch(`/api/receipts/${currentReceiptId}`, {
          method: 'DELETE',
        })
      } catch (error) {
        console.error('Error deleting receipt:', error)
      }
      setCurrentReceiptId(null)
    }
  }

  const parseReceiptItems = async (
    receiptId: string
  ): Promise<AssignableItem[]> => {
    const response = await fetch(`/api/receipts/${receiptId}/parse`, {
      method: 'POST',
    })

    if (!response.ok) {
      const errorData = await response.json()
      throw new Error(errorData.error || 'Failed to parse receipt')
    }

    const data = await response.json()
    return data.data.items
  }

  const handleCreateDebts = async (assignments: ReceiptItemAssignment[]) => {
    if (!groupId) {
      setError('Please select a group first')
      return
    }

    setIsCreatingDebts(true)
    setError('')

    try {
      // Create one debt per borrower and collect their IDs
      const createdDebtIds: number[] = []
      for (const assignment of assignments) {
        const result = await createDebt({
          amount: assignment.amount,
          description: assignment.description || undefined,
          borrowerId: assignment.borrowerId,
          groupId: parseInt(groupId),
        })

        if (!result.success) {
          toast.error(result.error || 'Failed to create debt')
          setIsCreatingDebts(false)
          return
        }

        if (result.debt?.id) {
          createdDebtIds.push(result.debt.id)
        }
      }

      // Link receipt to all created debts if we have a receipt
      if (currentReceiptId && createdDebtIds.length > 0) {
        try {
          await linkReceiptToDebts(currentReceiptId, createdDebtIds)
        } catch (err) {
          console.error('Error linking receipt to debts:', err)
          // Don't fail the whole operation if linking fails
        }
      }

      const groupName = groups.find(group => group.id.toString() === groupId)?.name
      const debtCount = `${assignments.length} debt${assignments.length > 1 ? 's' : ''}`
      toast.success(`Created ${debtCount}`)

      // Add confirmation message with a link onward to the group
      setMessages(prev => [...prev, {
        role: 'assistant',
        content: `Successfully created ${debtCount}${groupName ? ` in ${groupName}` : ''}!`,
        id: Date.now().toString(),
        groupHref: `/groups/${groupId}`,
      }])

      // Clear parsed items and receipt ID
      setParsedItems(null)
      setCurrentReceiptId(null)

      // Refresh the page data
      router.refresh()
    } catch (err) {
      toast.error('An error occurred while creating debts')
      console.error('Error:', err)
    } finally {
      setIsCreatingDebts(false)
    }
  }

  const handleCancelAssignment = async () => {
    await deleteCurrentReceipt()
    setParsedItems(null)
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()

    // Allow submit if there's text OR a pending image
    if (!input.trim() && !pendingImage) return
    if (!groupId) {
      setError('Please select a group first')
      return
    }

    let uploadedImageUrl: string | null = null
    let receiptId: string | null = null

    // Upload pending image if there is one
    if (pendingImage) {
      setIsUploading(true)
      try {
        const result = await uploadImage(pendingImage.file)
        uploadedImageUrl = result.signedUrl
        receiptId = result.receiptId
        setCurrentReceiptId(receiptId)
      } catch (err) {
        const errorMessage = err instanceof Error ? err.message : 'Failed to upload image'
        setError(errorMessage)
        setIsUploading(false)
        return
      }
      setIsUploading(false)
    }

    const userMessage: ChatMessage = {
      role: 'user',
      content: input.trim() || 'Analyze this receipt',
      id: Date.now().toString(),
      imageUrl: uploadedImageUrl || undefined,
    }

    setMessages(prev => [...prev, userMessage])
    setInput('')
    clearPendingImage()
    setError('')

    if (receiptId) {
      // Receipt flow: parse items + prices, then let the user assign them manually
      setIsParsing(true)
      try {
        const items = await parseReceiptItems(receiptId)
        setParsedItems(items)
        setParsedKey(prev => prev + 1)

        const assistantMessage: ChatMessage = {
          role: 'assistant',
          content: `I found ${items.length} item${items.length > 1 ? 's' : ''} on the receipt. Assign them to group members below and I'll create the debts:`,
          id: Date.now().toString(),
        }
        setMessages(prev => [...prev, assistantMessage])
      } catch (err) {
        const errorMessage = err instanceof Error ? err.message : 'Failed to parse receipt'
        setError(errorMessage)
        // Clean up the receipt we can't parse
        try {
          await fetch(`/api/receipts/${receiptId}`, { method: 'DELETE' })
        } catch (deleteErr) {
          console.error('Error deleting receipt:', deleteErr)
        }
        setCurrentReceiptId(null)
      } finally {
        setIsParsing(false)
      }
      return
    }

    // Text-only flow: regular chat with the agent
    setIsLoading(true)

    try {
      // Convert our message format to LangChain format
      const langchainMessages = [...messages, userMessage].map(msg => ({
        type: msg.role === 'user' ? 'human' : 'ai',
        content: msg.content,
      }))

      const response = await fetch('/api/agent', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          messages: langchainMessages,
          groupId: parseInt(groupId),
        }),
      })

      if (!response.ok) {
        const errorData = await response.json()
        throw new Error(errorData.error || 'Failed to get response')
      }

      const data = await response.json()

      const lastMessage = data.messages[data.messages.length - 1]
      const content = lastMessage.content || lastMessage.kwargs?.content || 'No response'

      const assistantMessage: ChatMessage = {
        role: 'assistant',
        content,
        id: Date.now().toString(),
      }

      setMessages(prev => [...prev, assistantMessage])
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'An error occurred'
      setError(errorMessage)
      console.error('Error:', err)
    } finally {
      setIsLoading(false)
    }
  }

  const hasGroups = groups.length > 0
  const showZeroGroups = !isLoadingGroups && !hasGroups

  return (
    <div className="flex h-[calc(100svh-var(--header-height)-4rem)] flex-col gap-6">
      <PageHeader
        title="AI Assistant"
        description="Describe an expense or paste a receipt and turn it into debts for your group."
        actions={
          !showZeroGroups && (
            <div className="flex items-center gap-2">
              <Label htmlFor="ai-group-picker" className="text-muted-foreground">
                Group
              </Label>
              <Select
                value={groupId}
                onValueChange={setGroupId}
                disabled={isLoadingGroups}
              >
                <SelectTrigger id="ai-group-picker" className="w-44">
                  <SelectValue
                    placeholder={isLoadingGroups ? 'Loading groups…' : 'Select a group'}
                  />
                </SelectTrigger>
                <SelectContent>
                  {groups.map((group) => (
                    <SelectItem key={group.id} value={group.id.toString()}>
                      {group.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          )
        }
      />

      {showZeroGroups ? (
        <Empty className="min-h-0 flex-1 border border-dashed">
          <EmptyHeader>
            <EmptyMedia variant="icon">
              <Users />
            </EmptyMedia>
            <EmptyTitle>You need a group first</EmptyTitle>
            <EmptyDescription>
              The AI assistant creates debts inside one of your groups. Create a
              group and invite your friends to get started.
            </EmptyDescription>
          </EmptyHeader>
          <EmptyContent>
            <Button asChild>
              <Link href="/groups">
                <Plus />
                Create a group
              </Link>
            </Button>
          </EmptyContent>
        </Empty>
      ) : (
        <Card className="flex min-h-0 flex-1 flex-col">
          <CardContent className="flex min-h-0 flex-1 flex-col gap-3 p-4 sm:p-6">
            {messages.length === 0 && !isLoading ? (
              <Empty className="min-h-0 flex-1 border border-dashed">
                <EmptyHeader>
                  <EmptyMedia variant="icon">
                    <Sparkles />
                  </EmptyMedia>
                  <EmptyTitle>Start a conversation</EmptyTitle>
                  <EmptyDescription>
                    Ask about splitting an expense, or paste a receipt image to
                    extract debts automatically.
                  </EmptyDescription>
                </EmptyHeader>
                <EmptyContent>
                  <div className="flex flex-wrap justify-center gap-2">
                    {SUGGESTED_PROMPTS.map((prompt) => (
                      <Button
                        key={prompt}
                        type="button"
                        variant="outline"
                        size="sm"
                        onClick={() => {
                          setInput(prompt)
                          inputRef.current?.focus()
                        }}
                      >
                        {prompt}
                      </Button>
                    ))}
                  </div>
                </EmptyContent>
              </Empty>
            ) : (
              <ScrollArea ref={scrollAreaRef} className="min-h-0 flex-1">
                <div className="space-y-4 pr-3">
                  {messages.map((message, index) => (
                    <ChatMessageBubble
                      key={message.id || index}
                      message={message}
                      reviewPanel={
                        parsedItems &&
                        members.length > 0 &&
                        currentReceiptId &&
                        index === messages.length - 1 ? (
                          <ReceiptAssignmentPanel
                            key={parsedKey}
                            items={parsedItems}
                            members={members}
                            isCreating={isCreatingDebts}
                            onCreate={handleCreateDebts}
                            onCancel={handleCancelAssignment}
                          />
                        ) : undefined
                      }
                    />
                  ))}
                  {(isLoading || isParsing) && <ThinkingBubble label={isParsing ? 'Parsing receipt…' : undefined} />}
                </div>
              </ScrollArea>
            )}

            {error && (
              <Alert variant="destructive">
                <CircleAlert />
                <AlertTitle>Something went wrong</AlertTitle>
                <AlertDescription>{error}</AlertDescription>
              </Alert>
            )}

            {pendingImage && (
              <div className="flex items-center gap-3 rounded-md border p-2">
                <img
                  src={pendingImage.url}
                  alt="Image ready to send"
                  className="size-12 rounded-md object-cover"
                />
                <Badge variant="secondary">Image attached</Badge>
                <Button
                  type="button"
                  variant="ghost"
                  size="icon-sm"
                  className="ml-auto"
                  onClick={clearPendingImage}
                  aria-label="Remove image"
                >
                  <X />
                </Button>
              </div>
            )}

            {/* Hidden file input */}
            <input
              ref={fileInputRef}
              type="file"
              accept="image/jpeg,image/jpg,image/png,image/webp,image/gif"
              onChange={handleFileSelect}
              className="hidden"
            />

            <form onSubmit={handleSubmit} className="flex gap-2">
              <Button
                type="button"
                variant="outline"
                size="icon"
                onClick={() => fileInputRef.current?.click()}
                disabled={isLoading || isUploading || !groupId}
                aria-label="Upload image"
              >
                <ImageIcon />
              </Button>
              <Input
                ref={inputRef}
                value={input}
                onChange={(e) => setInput(e.target.value)}
                placeholder={pendingImage ? "Add a message (optional)..." : "Type your message or paste an image..."}
                disabled={isLoading || isUploading || !groupId}
                className="flex-1"
              />
              <Button
                type="submit"
                disabled={isLoading || isUploading || isParsing || !groupId || (!input.trim() && !pendingImage)}
              >
                {isUploading && <Spinner />}
                {isUploading ? 'Uploading…' : 'Send'}
              </Button>
            </form>
          </CardContent>
        </Card>
      )}
    </div>
  )
}
