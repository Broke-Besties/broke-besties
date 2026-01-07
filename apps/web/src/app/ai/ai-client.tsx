'use client'

import { useState, useRef, useEffect } from 'react'
import { useSearchParams } from 'next/navigation'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { cn } from '@/lib/utils'

type Message = {
  role: 'user' | 'assistant' | 'system'
  content: string
  id?: string
  imageUrl?: string
  pendingAction?: {
    toolCalls: Array<{
      name: string
      args: Record<string, unknown>
    }>
  }
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
  const [pendingApproval, setPendingApproval] = useState<{
    toolCalls: Array<{ name: string; args: Record<string, unknown> }>
  } | null>(null)
  const [editedToolCalls, setEditedToolCalls] = useState<Array<{ name: string; args: Record<string, unknown> }>>([])
  const [isEditingToolCalls, setIsEditingToolCalls] = useState(false)
  const scrollAreaRef = useRef<HTMLDivElement>(null)
  const fileInputRef = useRef<HTMLInputElement>(null)
  const inputRef = useRef<HTMLInputElement>(null)

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

  // Handle paste events for images
  useEffect(() => {
    const handlePaste = async (e: ClipboardEvent) => {
      const items = e.clipboardData?.items
      if (!items) return

      for (const item of items) {
        if (item.type.startsWith('image/')) {
          e.preventDefault()
          const file = item.getAsFile()
          if (file) {
            handleImageFile(file)
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

  const fileToBase64 = (file: File): Promise<string> => {
    return new Promise((resolve, reject) => {
      const reader = new FileReader()
      reader.onload = () => resolve(reader.result as string)
      reader.onerror = reject
      reader.readAsDataURL(file)
    })
  }

  const uploadImage = async (file: File): Promise<{ signedUrl: string; base64: string }> => {
    const formData = new FormData()
    formData.append('file', file)
    formData.append('groupId', groupId)

    // Convert to base64 in parallel with upload
    const [response, base64] = await Promise.all([
      fetch('/api/receipts/upload', {
        method: 'POST',
        body: formData,
      }),
      fileToBase64(file),
    ])

    if (!response.ok) {
      const errorData = await response.json()
      throw new Error(errorData.error || 'Failed to upload image')
    }

    const data = await response.json()
    return { signedUrl: data.data.signedUrl, base64 }
  }

  const clearPendingImage = () => {
    if (pendingImage) {
      URL.revokeObjectURL(pendingImage.url)
      setPendingImage(null)
    }
  }

  const handleApprove = async () => {
    if (!pendingApproval) return

    setIsLoading(true)
    setError('')
    setPendingApproval(null)
    setIsEditingToolCalls(false)

    try {
      // Use edited tool calls if available, otherwise use original
      const toolCallsToExecute = editedToolCalls.length > 0 ? editedToolCalls : pendingApproval.toolCalls

      const langchainMessages = messages
        .filter(msg => !msg.pendingAction)
        .map(msg => ({
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
          executeApproved: true,
          toolCallsOverride: toolCallsToExecute,
        }),
      })

      if (!response.ok) {
        const errorData = await response.json()
        throw new Error(errorData.error || 'Failed to execute action')
      }

      const data = await response.json()

      const lastMessage = data.messages[data.messages.length - 1]

      const assistantMessage: Message = {
        role: 'assistant',
        content: lastMessage.content || lastMessage.kwargs?.content || 'Action completed',
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

  const handleEditToolCall = (index: number, field: string, value: string) => {
    const calls = editedToolCalls.length > 0 ? [...editedToolCalls] : [...(pendingApproval?.toolCalls || [])]
    calls[index] = {
      ...calls[index],
      args: {
        ...calls[index].args,
        [field]: field === 'amount' ? parseFloat(value) || 0 : value,
      },
    }
    setEditedToolCalls(calls)
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()

    // Allow submit if there's text OR a pending image
    if (!input.trim() && !pendingImage) return
    if (!groupId) {
      setError('Please select a group first')
      return
    }

    if (pendingApproval) {
      setPendingApproval(null)
    }

    let uploadedImageUrl: string | null = null
    let uploadedImageBase64: string | null = null

    // Upload pending image if there is one
    if (pendingImage) {
      setIsUploading(true)
      try {
        const result = await uploadImage(pendingImage.file)
        uploadedImageUrl = result.signedUrl
        uploadedImageBase64 = result.base64
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
          imageBase64: uploadedImageBase64,
        }),
      })

      if (!response.ok) {
        const errorData = await response.json()
        throw new Error(errorData.error || 'Failed to get response')
      }

      const data = await response.json()

      // Check if there's a pending action that needs approval
      if (data.pendingAction) {
        setPendingApproval({ toolCalls: data.pendingAction.toolCalls })
        setEditedToolCalls([])
        setIsEditingToolCalls(false)

        // Fetch group members to get emails
        let emails: Record<string, string> = {}
        try {
          const res = await fetch(`/api/groups/${groupId}`)
          if (res.ok) {
            const { group } = await res.json()
            emails = Object.fromEntries(
              group.members.map((m: any) => [m.userId, m.user.email])
            )
          }
        } catch (err) {
          console.error('Failed to fetch members:', err)
        }

        const toolCallsDisplay = data.pendingAction.toolCalls
          .map((tc: any, idx: number) => {
            const from = tc.args.borrowerId === user.id ? 'You' : (emails[tc.args.borrowerId] || tc.args.borrowerId)
            const to = tc.args.userId === user.id ? 'You' : (emails[tc.args.userId] || 'Unknown')
            const label = data.pendingAction.toolCalls.length > 1 ? `Debt ${idx + 1}\n` : ''
            return `${label}Amount: $${tc.args.amount}\nFrom: ${from}\nTo: ${to}\nDescription: ${tc.args.description || 'N/A'}`
          })
          .join('\n\n')

        setMessages(prev => [...prev, {
          role: 'assistant',
          content: `I'd like to create the following debt(s):\n\n${toolCallsDisplay}`,
          id: Date.now().toString(),
          pendingAction: data.pendingAction,
        }])
      } else {
        const lastMessage = data.messages[data.messages.length - 1]

        const assistantMessage: Message = {
          role: 'assistant',
          content: lastMessage.content || lastMessage.kwargs?.content || 'No response',
          id: Date.now().toString(),
        }

        setMessages(prev => [...prev, assistantMessage])
        setPendingApproval(null)
      }
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
                      'rounded-lg px-4 py-2 max-w-[80%]',
                      message.role === 'user'
                        ? 'bg-primary text-primary-foreground'
                        : 'bg-muted'
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
                    {message.pendingAction && pendingApproval && index === messages.length - 1 && (
                      <div className="mt-3">
                        {isEditingToolCalls ? (
                          <div className="space-y-3">
                            {(editedToolCalls.length > 0 ? editedToolCalls : pendingApproval.toolCalls).map((tc: any, tcIndex: number) => (
                              <div key={tcIndex} className="p-3 bg-background/50 rounded border space-y-2">
                                <div className="text-xs font-semibold mb-2">Debt {tcIndex + 1}</div>
                                <div className="grid grid-cols-2 gap-2">
                                  <div>
                                    <label className="text-xs">Amount ($)</label>
                                    <Input
                                      type="number"
                                      value={tc.args.amount}
                                      onChange={(e) => handleEditToolCall(tcIndex, 'amount', e.target.value)}
                                      className="h-8 text-sm"
                                    />
                                  </div>
                                  <div>
                                    <label className="text-xs">Description</label>
                                    <Input
                                      value={tc.args.description || ''}
                                      onChange={(e) => handleEditToolCall(tcIndex, 'description', e.target.value)}
                                      className="h-8 text-sm"
                                    />
                                  </div>
                                </div>
                              </div>
                            ))}
                            <div className="flex gap-2">
                              <Button size="sm" onClick={handleApprove} disabled={isLoading}>
                                Save & Approve
                              </Button>
                              <Button size="sm" variant="outline" onClick={() => setIsEditingToolCalls(false)}>
                                Cancel Edit
                              </Button>
                            </div>
                          </div>
                        ) : (
                          <div className="flex gap-2">
                            <Button size="sm" onClick={handleApprove} disabled={isLoading}>
                              Approve
                            </Button>
                            <Button size="sm" variant="outline" onClick={() => setIsEditingToolCalls(true)} disabled={isLoading}>
                              Edit
                            </Button>
                          </div>
                        )}
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
