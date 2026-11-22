'use client'

import { useState, useRef, useEffect } from 'react'
import Link from 'next/link'
import Image from 'next/image'
import { useSearchParams, useRouter } from 'next/navigation'
import {
  ArrowUp,
  CircleAlert,
  ImagePlus,
  Plus,
  ReceiptText,
  ScanLine,
  Users,
  X,
} from 'lucide-react'
import { toast } from 'sonner'
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert'
import { Badge } from '@/components/ui/badge'
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
  Attachment,
  AttachmentAction,
  AttachmentActions,
  AttachmentContent,
  AttachmentDescription,
  AttachmentMedia,
  AttachmentTitle,
} from '@/components/ui/attachment'
import { Field, FieldLabel } from '@/components/ui/field'
import {
  InputGroup,
  InputGroupAddon,
  InputGroupButton,
  InputGroupTextarea,
} from '@/components/ui/input-group'
import {
  MessageScroller,
  MessageScrollerButton,
  MessageScrollerContent,
  MessageScrollerItem,
  MessageScrollerProvider,
  MessageScrollerViewport,
} from '@/components/ui/message-scroller'
import {
  Empty,
  EmptyContent,
  EmptyDescription,
  EmptyHeader,
  EmptyMedia,
  EmptyTitle,
} from '@/components/ui/empty'
import { Label } from '@/components/ui/label'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectGroup,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { Spinner } from '@/components/ui/spinner'
import { PageHeader } from '@/components/page-header'
import { createDebt } from '@/app/(app)/groups/[id]/actions'
import {
  ChatMessageBubble,
  ThinkingBubble,
  type ChatMessage,
} from './chat-message'
import {
  ReceiptAssignmentPanel,
  type AssignableItem,
  type GroupMemberOption,
  type ReceiptItemAssignment,
} from './receipt-assignment-panel'
import { buildAgentRequest } from './agent-request'
import { McpConnectDialog } from './mcp-connect-dialog'
import type { AgentMode } from '@/mcp/mode'

type Group = {
  id: number
  name: string
}

const SUGGESTED_PROMPTS = [
  'How do I split a shared dinner?',
  'What can you help me with?',
]

export default function AIPageClient({
  agentMode = 'v1',
  mcpUrl = '',
}: {
  agentMode?: AgentMode
  mcpUrl?: string
} = {}) {
  const searchParams = useSearchParams()
  const [messages, setMessages] = useState<ChatMessage[]>([])
  const [input, setInput] = useState('')
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState('')
  const [groupId, setGroupId] = useState('')
  const [groups, setGroups] = useState<Group[]>([])
  const [isLoadingGroups, setIsLoadingGroups] = useState(true)
  const [pendingImage, setPendingImage] = useState<{
    url: string
    file: File
  } | null>(null)
  const [isUploading, setIsUploading] = useState(false)
  const [currentReceiptId, setCurrentReceiptId] = useState<string | null>(null)
  const [parsedItems, setParsedItems] = useState<AssignableItem[] | null>(null)
  const [parsedKey, setParsedKey] = useState(0)
  const [members, setMembers] = useState<GroupMemberOption[]>([])
  const [isCreatingDebts, setIsCreatingDebts] = useState(false)
  const [isParsing, setIsParsing] = useState(false)
  const fileInputRef = useRef<HTMLInputElement>(null)
  const inputRef = useRef<HTMLTextAreaElement>(null)
  const router = useRouter()
  const isBusy = isLoading || isUploading || isParsing || isCreatingDebts
  const isReviewing = parsedItems !== null
  const composerDisabled =
    isBusy || isReviewing || (agentMode === 'v1' && !groupId)

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
        } else if (agentMode === 'v1' && data.groups.length > 0) {
          // Auto-select first group for the legacy flow, which needs one.
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
  }, [searchParams, agentMode])

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
              }),
            ),
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
      if (composerDisabled) {
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
            const validTypes = [
              'image/jpeg',
              'image/jpg',
              'image/png',
              'image/webp',
              'image/gif',
            ]
            if (!validTypes.includes(file.type)) {
              setError(
                'Invalid file type. Only JPEG, PNG, WebP, and GIF are allowed',
              )
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
  }, [composerDisabled])

  const handleImageFile = (file: File) => {
    if (!groupId) {
      setError('Please select a group first')
      return
    }

    // Validate file type
    const validTypes = [
      'image/jpeg',
      'image/jpg',
      'image/png',
      'image/webp',
      'image/gif',
    ]
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

  const uploadImage = async (
    file: File,
  ): Promise<{ signedUrl: string; receiptId: string }> => {
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
    receiptId: string,
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

      const groupName = groups.find(
        (group) => group.id.toString() === groupId,
      )?.name
      const debtCount = `${assignments.length} debt${assignments.length > 1 ? 's' : ''}`
      toast.success(`Created ${debtCount}`)

      // Add confirmation message with a link onward to the group
      setMessages((prev) => [
        ...prev,
        {
          role: 'assistant',
          content: `Successfully created ${debtCount}${groupName ? ` in ${groupName}` : ''}!`,
          id: crypto.randomUUID(),
          groupHref: `/groups/${groupId}`,
        },
      ])

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

    if (composerDisabled) return

    // Allow submit if there's text OR a pending image
    if (!input.trim() && !pendingImage) return
    if ((agentMode === 'v1' || pendingImage) && !groupId) {
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
        const errorMessage =
          err instanceof Error ? err.message : 'Failed to upload image'
        setError(errorMessage)
        setIsUploading(false)
        return
      }
      setIsUploading(false)
    }

    const userMessage: ChatMessage = {
      role: 'user',
      content: input.trim() || 'Analyze this receipt',
      id: crypto.randomUUID(),
      imageUrl: uploadedImageUrl || undefined,
    }

    setMessages((prev) => [...prev, userMessage])
    setInput('')
    clearPendingImage()
    setError('')

    if (receiptId) {
      // Receipt flow: parse items + prices, then let the user assign them manually
      setIsParsing(true)
      try {
        const items = await parseReceiptItems(receiptId)
        setParsedItems(items)
        setParsedKey((prev) => prev + 1)

        const assistantMessage: ChatMessage = {
          role: 'assistant',
          content: `I found ${items.length} item${items.length > 1 ? 's' : ''} on the receipt. Assign them to group members below and I'll create the debts:`,
          id: crypto.randomUUID(),
        }
        setMessages((prev) => [...prev, assistantMessage])
      } catch (err) {
        const errorMessage =
          err instanceof Error ? err.message : 'Failed to parse receipt'
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
      const response = await fetch('/api/agent', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(
          buildAgentRequest(
            [...messages, userMessage],
            groupId || null,
            receiptId || currentReceiptId,
          ),
        ),
      })

      if (!response.ok) {
        const errorData = await response.json()
        throw new Error(errorData.error || 'Failed to get response')
      }

      const data = await response.json()

      const lastMessage = data.messages[data.messages.length - 1]
      const content =
        lastMessage.content || lastMessage.kwargs?.content || 'No response'

      const assistantMessage: ChatMessage = {
        role: 'assistant',
        content,
        id: crypto.randomUUID(),
      }

      setMessages((prev) => [...prev, assistantMessage])
    } catch (err) {
      const errorMessage =
        err instanceof Error ? err.message : 'An error occurred'
      setError(errorMessage)
      console.error('Error:', err)
    } finally {
      setIsLoading(false)
    }
  }

  const hasGroups = groups.length > 0
  const showZeroGroups = agentMode === 'v1' && !isLoadingGroups && !hasGroups

  return (
    <div className="flex h-[calc(100svh-var(--header-height)-4rem)] min-h-[34rem] flex-col gap-5">
      <PageHeader
        title="AI Assistant"
        description="A little less math. A little more time with your besties."
        actions={
          <div className="flex flex-wrap items-center justify-end gap-2">
            <McpConnectDialog mcpUrl={mcpUrl} />
            {hasGroups && (
              <div className="flex items-center gap-2">
                <Label htmlFor="ai-group-picker">
                  Split with{agentMode === 'v2' ? ' (optional)' : ''}
                </Label>
                <Select
                  value={groupId}
                  onValueChange={setGroupId}
                  disabled={
                    isLoadingGroups || isBusy || isReviewing || !!pendingImage
                  }
                >
                  <SelectTrigger id="ai-group-picker" className="w-48 sm:w-56">
                    <SelectValue
                      placeholder={
                        isLoadingGroups ? 'Loading groups…' : 'Select a group'
                      }
                    />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectGroup>
                      {groups.map((group) => (
                        <SelectItem key={group.id} value={group.id.toString()}>
                          {group.name}
                        </SelectItem>
                      ))}
                    </SelectGroup>
                  </SelectContent>
                </Select>
              </div>
            )}
          </div>
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
              Create a group and invite your friends before splitting a receipt.
            </EmptyDescription>
          </EmptyHeader>
          <EmptyContent>
            <Button asChild>
              <Link href="/groups">
                <Plus data-icon="inline-start" />
                Create a group
              </Link>
            </Button>
          </EmptyContent>
          {error && (
            <Alert variant="destructive">
              <CircleAlert />
              <AlertTitle>Could not load groups</AlertTitle>
              <AlertDescription>{error}</AlertDescription>
            </Alert>
          )}
        </Empty>
      ) : (
        <Card className="flex min-h-0 flex-1 flex-col gap-0 overflow-hidden py-0">
          <CardHeader className="gap-3 border-b px-4 py-4 sm:px-6">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <CardTitle className="flex items-center gap-2">
                <ScanLine className="size-4" />
                Receipt studio
              </CardTitle>
              <Badge variant="secondary" role="status">
                {isUploading
                  ? 'Uploading receipt'
                  : isParsing
                    ? 'Reading receipt'
                    : isCreatingDebts
                      ? 'Creating debts'
                      : isReviewing
                        ? 'Ready to review'
                        : isLoading
                          ? 'Thinking'
                          : 'Ready when you are'}
              </Badge>
            </div>
            <CardDescription>
              Upload a receipt. Check the items. Choose who owes what.
            </CardDescription>
          </CardHeader>

          <CardContent className="flex min-h-0 flex-1 flex-col p-0">
            {messages.length === 0 && !isLoading ? (
              <Empty className="min-h-0 flex-1 overflow-y-auto px-4 py-6 sm:py-10">
                <EmptyHeader>
                  <EmptyMedia variant="icon">
                    <ReceiptText />
                  </EmptyMedia>
                  <EmptyTitle>One receipt. Everyone’s share.</EmptyTitle>
                  <EmptyDescription>
                    Upload or paste a receipt and we’ll read the items for you.
                    You review the prices and assign each item before creating
                    debts.
                  </EmptyDescription>
                </EmptyHeader>
                <EmptyContent>
                  <Button
                    type="button"
                    onClick={() => fileInputRef.current?.click()}
                    disabled={composerDisabled}
                  >
                    <ImagePlus data-icon="inline-start" />
                    Upload a receipt
                  </Button>
                  <p className="text-xs text-muted-foreground">
                    JPEG, PNG, WebP or GIF · Up to 10 MB
                  </p>
                </EmptyContent>
              </Empty>
            ) : (
              <MessageScrollerProvider autoScroll>
                <MessageScroller>
                  <MessageScrollerViewport aria-label="Conversation">
                    <MessageScrollerContent className="gap-6 px-4 py-6 sm:px-6">
                      {messages.map((message, index) => (
                        <MessageScrollerItem
                          key={message.id || index}
                          messageId={message.id || String(index)}
                          scrollAnchor={message.role === 'user'}
                        >
                          <ChatMessageBubble
                            message={message}
                            reviewPanel={
                              parsedItems &&
                              currentReceiptId &&
                              index === messages.length - 1 ? (
                                members.length > 0 ? (
                                  <ReceiptAssignmentPanel
                                    key={parsedKey}
                                    items={parsedItems}
                                    members={members}
                                    isCreating={isCreatingDebts}
                                    onCreate={handleCreateDebts}
                                    onCancel={handleCancelAssignment}
                                  />
                                ) : (
                                  <Alert>
                                    <Users />
                                    <AlertTitle>
                                      Group members aren’t available yet
                                    </AlertTitle>
                                    <AlertDescription>
                                      Wait for the group to load, or cancel and
                                      try again.
                                      <Button
                                        variant="outline"
                                        size="sm"
                                        onClick={handleCancelAssignment}
                                      >
                                        Cancel review
                                      </Button>
                                    </AlertDescription>
                                  </Alert>
                                )
                              ) : undefined
                            }
                          />
                        </MessageScrollerItem>
                      ))}
                      {(isLoading || isParsing) && (
                        <MessageScrollerItem messageId="pending">
                          <ThinkingBubble
                            label={
                              isParsing
                                ? 'Reading items and prices from your receipt…'
                                : undefined
                            }
                          />
                        </MessageScrollerItem>
                      )}
                    </MessageScrollerContent>
                  </MessageScrollerViewport>
                  <MessageScrollerButton />
                </MessageScroller>
              </MessageScrollerProvider>
            )}
          </CardContent>

          <CardFooter className="flex shrink-0 flex-col items-stretch gap-3 border-t px-4 py-4 sm:px-6">
            {error && (
              <Alert variant="destructive">
                <CircleAlert />
                <AlertTitle>Something went wrong</AlertTitle>
                <AlertDescription>{error}</AlertDescription>
              </Alert>
            )}
            {messages.length === 0 && (
              <div className="flex flex-wrap items-center gap-2">
                <span className="text-xs text-muted-foreground">
                  Or ask a question
                </span>
                {SUGGESTED_PROMPTS.map((prompt) => (
                  <Button
                    key={prompt}
                    type="button"
                    variant="outline"
                    size="sm"
                    disabled={composerDisabled}
                    onClick={() => {
                      setInput(prompt)
                      inputRef.current?.focus()
                    }}
                  >
                    {prompt}
                  </Button>
                ))}
              </div>
            )}
            <input
              ref={fileInputRef}
              type="file"
              accept="image/jpeg,image/jpg,image/png,image/webp,image/gif"
              onChange={handleFileSelect}
              className="hidden"
              disabled={composerDisabled}
              aria-label="Choose receipt image"
            />
            <form onSubmit={handleSubmit}>
              <Field>
                <FieldLabel htmlFor="ai-message" className="sr-only">
                  Message or receipt instructions
                </FieldLabel>
                <InputGroup>
                  <InputGroupTextarea
                    id="ai-message"
                    ref={inputRef}
                    value={input}
                    onChange={(e) => setInput(e.target.value)}
                    onKeyDown={(e) => {
                      if (
                        e.key === 'Enter' &&
                        !e.shiftKey &&
                        !e.nativeEvent.isComposing
                      ) {
                        e.preventDefault()
                        e.currentTarget.form?.requestSubmit()
                      }
                    }}
                    placeholder={
                      isReviewing
                        ? 'Review your receipt above to continue'
                        : pendingImage
                          ? 'Add instructions (optional)…'
                          : 'Ask about an expense, or paste a receipt…'
                    }
                    disabled={composerDisabled}
                    className="max-h-32 min-h-16"
                  />
                  {pendingImage && (
                    <InputGroupAddon align="block-start">
                      <Attachment
                        state={isUploading ? 'uploading' : 'idle'}
                        className="w-full sm:max-w-sm"
                      >
                        <AttachmentMedia variant="image">
                          <Image
                            src={pendingImage.url}
                            alt="Receipt ready to scan"
                            width={40}
                            height={40}
                            unoptimized
                          />
                        </AttachmentMedia>
                        <AttachmentContent>
                          <AttachmentTitle>
                            {pendingImage.file.name}
                          </AttachmentTitle>
                          <AttachmentDescription>
                            {isUploading ? 'Uploading…' : 'Ready to scan'}
                          </AttachmentDescription>
                        </AttachmentContent>
                        <AttachmentActions>
                          <AttachmentAction
                            type="button"
                            onClick={clearPendingImage}
                            disabled={isBusy}
                            aria-label="Remove receipt"
                          >
                            <X />
                          </AttachmentAction>
                        </AttachmentActions>
                      </Attachment>
                    </InputGroupAddon>
                  )}
                  <InputGroupAddon
                    align="block-end"
                    className="justify-between"
                  >
                    <InputGroupButton
                      size="sm"
                      onClick={() => fileInputRef.current?.click()}
                      disabled={composerDisabled}
                      aria-label="Attach receipt"
                    >
                      <ImagePlus data-icon="inline-start" />
                      Attach receipt
                    </InputGroupButton>
                    <InputGroupButton
                      type="submit"
                      variant="default"
                      size="sm"
                      disabled={
                        composerDisabled || (!input.trim() && !pendingImage)
                      }
                    >
                      {isUploading ? (
                        <Spinner />
                      ) : pendingImage ? (
                        <ScanLine data-icon="inline-start" />
                      ) : (
                        <ArrowUp data-icon="inline-start" />
                      )}
                      {isUploading
                        ? 'Uploading…'
                        : pendingImage
                          ? 'Scan receipt'
                          : 'Send'}
                    </InputGroupButton>
                  </InputGroupAddon>
                </InputGroup>
              </Field>
            </form>
            <p className="text-center text-xs text-muted-foreground">
              {isReviewing
                ? 'Check the scan for mistakes before creating debts.'
                : 'AI can make mistakes. Check receipt items and amounts before confirming.'}
            </p>
          </CardFooter>
        </Card>
      )}
    </div>
  )
}
