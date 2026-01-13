'use client'

import { useState, useRef, useEffect } from 'react'
import { useSearchParams, useRouter } from 'next/navigation'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { cn } from '@/lib/utils'
import { DebtFormItem } from '@/app/groups/[id]/debt-form-item'
import { createDebt } from '@/app/groups/[id]/actions'

type Message = {
  role: 'user' | 'assistant' | 'system'
  content: string
  id?: string
  imageUrl?: string
  debts?: Array<{
    borrowerName: string
    borrowerId: string
    amount: number
    description?: string
  }>
}

type Group = {
  id: number
  name: string
}

type AIPageClientProps = {
  user: any
}

export default function AIPageClient({ user }: AIPageClientProps) {
  const searchParams = useSearchParams()
  const [messages, setMessages] = useState<Message[]>([])
  const [input, setInput] = useState('')
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState('')
  const [groupId, setGroupId] = useState('')
  const [groups, setGroups] = useState<Group[]>([])
  const [isLoadingGroups, setIsLoadingGroups] = useState(true)
  const [pendingImage, setPendingImage] = useState<{ url: string; file: File } | null>(null)
  const [isUploading, setIsUploading] = useState(false)
  const [currentReceiptId, setCurrentReceiptId] = useState<string | null>(null)
  const [debtForms, setDebtForms] = useState<Array<{
    amount: string
    description: string
    borrowerId: string
    borrower: { id: string; name: string; email: string } | null
  }>>([])
  const [isCreatingDebts, setIsCreatingDebts] = useState(false)
  const [currentDebtIndex, setCurrentDebtIndex] = useState(0)
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
    if (scrollAreaRef.current) {
      scrollAreaRef.current.scrollTop = scrollAreaRef.current.scrollHeight
    }
  }, [messages])

  // Populate debt forms when a message with debts is received
  useEffect(() => {
    const lastMessage = messages[messages.length - 1]
    if (lastMessage?.debts && lastMessage.debts.length > 0) {
      const forms = lastMessage.debts.map(debt => ({
        amount: debt.amount.toString(),
        description: debt.description || '',
        borrowerId: debt.borrowerId,
        borrower: {
          id: debt.borrowerId,
          name: debt.borrowerName,
          email: debt.borrowerName, // Using name as email fallback
        },
      }))
      setDebtForms(forms)
      setCurrentDebtIndex(0) // Reset to first debt
    }
  }, [messages])

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

  const addNewDebt = () => {
    setDebtForms([...debtForms, {
      amount: '',
      description: '',
      borrowerId: '',
      borrower: null,
    }])
    setCurrentDebtIndex(debtForms.length)
  }

  const removeDebt = (index: number) => {
    if (debtForms.length === 1) return
    const newDebts = debtForms.filter((_, i) => i !== index)
    setDebtForms(newDebts)
    if (currentDebtIndex >= newDebts.length) {
      setCurrentDebtIndex(newDebts.length - 1)
    }
  }

  const updateDebtForm = (index: number, data: typeof debtForms[0]) => {
    const newDebts = [...debtForms]
    newDebts[index] = data
    setDebtForms(newDebts)
  }

  const handleCancelDebts = async () => {
    await deleteCurrentReceipt()
    setDebtForms([])
    setCurrentDebtIndex(0)
  }

  const handleCreateDebts = async () => {
    setIsCreatingDebts(true)
    setError('')

    try {
      // Validate all debts have required fields
      for (let i = 0; i < debtForms.length; i++) {
        const debt = debtForms[i]
        if (!debt.borrowerId) {
          setError(`Debt ${i + 1}: Please select a borrower`)
          setIsCreatingDebts(false)
          setCurrentDebtIndex(i)
          return
        }
        if (!debt.amount || parseFloat(debt.amount) <= 0) {
          setError(`Debt ${i + 1}: Please enter a valid amount`)
          setIsCreatingDebts(false)
          setCurrentDebtIndex(i)
          return
        }
      }

      // Create each debt and collect their IDs
      const createdDebtIds: number[] = []
      for (const debt of debtForms) {
        const result = await createDebt({
          amount: parseFloat(debt.amount),
          description: debt.description || undefined,
          borrowerId: debt.borrowerId,
          groupId: parseInt(groupId),
        })

        if (!result.success) {
          setError(result.error || 'Failed to create debt')
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

      // Add success message
      setMessages(prev => [...prev, {
        role: 'assistant',
        content: `Successfully created ${debtForms.length} debt${debtForms.length > 1 ? 's' : ''}!`,
        id: Date.now().toString(),
      }])

      // Clear debt forms, receipt ID, and reset index
      setDebtForms([])
      setCurrentReceiptId(null)
      setCurrentDebtIndex(0)

      // Refresh the page data
      router.refresh()
    } catch (err) {
      setError('An error occurred while creating debts')
      console.error('Error:', err)
    } finally {
      setIsCreatingDebts(false)
    }
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
        // Note: We only need the URL now, ReceiptTool will fetch the image itself
      } catch (err) {
        const errorMessage = err instanceof Error ? err.message : 'Failed to upload image'
        setError(errorMessage)
        setIsUploading(false)
        return
      }
      setIsUploading(false)
    }

    const userMessage: Message = {
      role: 'user',
      content: input.trim() || 'Analyze this receipt',
      id: Date.now().toString(),
      imageUrl: uploadedImageUrl || undefined,
    }

    setMessages(prev => [...prev, userMessage])
    setInput('')
    clearPendingImage()
    setIsLoading(true)
    setError('')

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
          imageUrl: uploadedImageUrl,
          receiptIds: receiptId ? [receiptId] : undefined,
        }),
      })

      if (!response.ok) {
        const errorData = await response.json()
        throw new Error(errorData.error || 'Failed to get response')
      }

      const data = await response.json()

      const lastMessage = data.messages[data.messages.length - 1]
      const content = lastMessage.content || lastMessage.kwargs?.content || 'No response'

      // Try to parse JSON from the content
      let parsedDebts = null
      try {
        const jsonMatch = content.match(/\{[\s\S]*"debtsReady"[\s\S]*\}/)
        if (jsonMatch) {
          const parsed = JSON.parse(jsonMatch[0])
          if (parsed.debtsReady && Array.isArray(parsed.debts)) {
            parsedDebts = parsed.debts
          }
        }
      } catch {
        // Not JSON, treat as regular message
      }

      const assistantMessage: Message = {
        role: 'assistant',
        content: parsedDebts ? 'I have the debt information ready. Please review and create:' : content,
        id: Date.now().toString(),
        debts: parsedDebts || undefined,
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

  return (
    <div className="container mx-auto p-4 max-w-4xl">
      <Card className="h-[calc(100vh-8rem)]">
        <CardHeader>
          <CardTitle>AI Agent Chat</CardTitle>
          <CardDescription>
            Chat with the LangGraph agent to manage debts and receipts
          </CardDescription>
          <div className="flex gap-2 mt-2">
            <select
              value={groupId}
              onChange={(e) => setGroupId(e.target.value)}
              disabled={isLoadingGroups}
              className="h-9 rounded-md border bg-background px-3 text-sm shadow-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 max-w-xs"
            >
              <option value="" disabled>
                {isLoadingGroups ? 'Loading groups...' : 'Select a group'}
              </option>
              {groups.map((group) => (
                <option key={group.id} value={group.id}>
                  {group.name}
                </option>
              ))}
            </select>
          </div>
        </CardHeader>
        <CardContent className="flex flex-col h-[calc(100%-8rem)]">
          <div className="flex-1 overflow-y-auto pr-4 mb-4" ref={scrollAreaRef}>
            <div className="space-y-4">
              {messages.length === 0 && (
                <div className="text-center text-muted-foreground py-8">
                  Start a conversation with the AI agent
                </div>
              )}
              {messages.map((message, index) => (
                <div
                  key={message.id || index}
                  className={cn(
                    'flex',
                    message.role === 'user' ? 'justify-end' : 'justify-start'
                  )}
                >
                  <div
                    className={cn(
                      'rounded-lg py-2 max-w-[80%] sm:max-w-[85%]',
                      message.role === 'user'
                        ? 'bg-primary text-primary-foreground px-3 sm:px-4'
                        : 'bg-muted px-2 sm:px-4'
                    )}
                  >
                    <div className="text-sm font-semibold mb-1">
                      {message.role === 'user' ? 'You' : 'Agent'}
                    </div>
                    {message.imageUrl && (
                      <div className="mb-2">
                        <img
                          src={message.imageUrl}
                          alt="Uploaded image"
                          className="max-w-full max-h-64 rounded-md object-contain"
                        />
                      </div>
                    )}
                    <div className="text-sm whitespace-pre-wrap">
                      {message.content}
                    </div>
                    {message.debts && debtForms.length > 0 && index === messages.length - 1 && (
                      <div className="mt-3 space-y-3 -mx-1 sm:mx-0">
                        <div className="px-1 sm:px-0">
                          <div className="p-3 sm:p-4 bg-background/50 rounded border">
                            <div className="text-xs font-semibold mb-3">
                              {debtForms.length > 1 && ` (${currentDebtIndex + 1} of ${debtForms.length})`}
                              {currentReceiptId && (
                                <span className="ml-2 text-muted-foreground font-normal">
                                  Receipt ID: {currentReceiptId.substring(0, 8)}...
                                </span>
                              )}
                            </div>
                            <DebtFormItem
                              debtData={debtForms[currentDebtIndex]}
                              groupId={parseInt(groupId)}
                              currentUserId={user?.id}
                              onChange={(data) => updateDebtForm(currentDebtIndex, data)}
                            />
                            
                            {/* Navigation for multiple debts */}
                            {debtForms.length > 1 && (
                              <div className="flex items-center justify-between rounded-md border bg-muted/30 p-2 mt-3">
                                <Button
                                  type="button"
                                  variant="ghost"
                                  size="sm"
                                  onClick={() => setCurrentDebtIndex(Math.max(0, currentDebtIndex - 1))}
                                  disabled={currentDebtIndex === 0}
                                >
                                  ← Prev
                                </Button>
                                <span className="text-sm text-muted-foreground">
                                  Debt {currentDebtIndex + 1} of {debtForms.length}
                                </span>
                                <Button
                                  type="button"
                                  variant="ghost"
                                  size="sm"
                                  onClick={() => setCurrentDebtIndex(Math.min(debtForms.length - 1, currentDebtIndex + 1))}
                                  disabled={currentDebtIndex === debtForms.length - 1}
                                >
                                  Next →
                                </Button>
                              </div>
                            )}

                            {/* Add/Remove debt buttons */}
                            <div className="flex gap-2 mt-3">
                              <Button
                                type="button"
                                variant="outline"
                                size="sm"
                                onClick={addNewDebt}
                                className="flex-1"
                              >
                                + Add another debt
                              </Button>
                              {debtForms.length > 1 && (
                                <Button
                                  type="button"
                                  variant="outline"
                                  size="sm"
                                  onClick={() => removeDebt(currentDebtIndex)}
                                >
                                  Remove
                                </Button>
                              )}
                            </div>
                          </div>
                        </div>

                        {/* Action buttons */}
                        <div className="flex gap-2 px-1 sm:px-0">
                          <Button 
                            size="sm" 
                            onClick={handleCreateDebts} 
                            disabled={isCreatingDebts || debtForms.some(d => !d.borrowerId || !d.amount || parseFloat(d.amount) <= 0)}
                          >
                            {isCreatingDebts ? 'Creating...' : `Create ${debtForms.length} Debt${debtForms.length > 1 ? 's' : ''}`}
                          </Button>
                          <Button size="sm" variant="outline" onClick={handleCancelDebts}>
                            Cancel
                          </Button>
                        </div>
                      </div>
                    )}
                  </div>
                </div>
              ))}
              {isLoading && (
                <div className="flex justify-start">
                  <div className="rounded-lg px-4 py-2 bg-muted">
                    <div className="text-sm font-semibold mb-1">Agent</div>
                    <div className="text-sm">Thinking...</div>
                  </div>
                </div>
              )}
            </div>
          </div>

          {error && (
            <div className="mb-4 p-3 bg-destructive/10 text-destructive rounded-md text-sm">
              {error}
            </div>
          )}

          {/* Pending image preview */}
          {pendingImage && (
            <div className="mb-4 p-3 bg-muted rounded-md">
              <div className="flex items-start gap-3">
                <img
                  src={pendingImage.url}
                  alt="Pending upload"
                  className="max-w-32 max-h-32 rounded-md object-contain"
                />
                <div className="flex-1">
                  <p className="text-sm text-muted-foreground mb-2">
                    Image ready to upload
                  </p>
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={clearPendingImage}
                  >
                    Remove
                  </Button>
                </div>
              </div>
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
              title="Upload image"
            >
              <svg
                xmlns="http://www.w3.org/2000/svg"
                width="20"
                height="20"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
              >
                <rect width="18" height="18" x="3" y="3" rx="2" ry="2" />
                <circle cx="9" cy="9" r="2" />
                <path d="m21 15-3.086-3.086a2 2 0 0 0-2.828 0L6 21" />
              </svg>
            </Button>
            <Input
              ref={inputRef}
              value={input}
              onChange={(e) => setInput(e.target.value)}
              placeholder={pendingImage ? "Add a message (optional)..." : "Type your message or paste an image..."}
              disabled={isLoading || isUploading || !groupId}
              className="flex-1"
            />
            <Button type="submit" disabled={isLoading || isUploading || !groupId || (!input.trim() && !pendingImage)}>
              {isUploading ? 'Uploading...' : 'Send'}
            </Button>
          </form>
        </CardContent>
      </Card>
    </div>
  )
}
