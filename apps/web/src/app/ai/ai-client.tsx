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
  const scrollAreaRef = useRef<HTMLDivElement>(null)

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

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()

    if (!input.trim()) return
    if (!groupId) {
      setError('Please enter a Group ID')
      return
    }

    const userMessage: Message = {
      role: 'user',
      content: input.trim(),
      id: Date.now().toString(),
    }

    setMessages(prev => [...prev, userMessage])
    setInput('')
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
        }),
      })

      if (!response.ok) {
        const errorData = await response.json()
        throw new Error(errorData.error || 'Failed to get response')
      }

      const data = await response.json()

      // Get the last message from the agent response
      const lastMessage = data.messages[data.messages.length - 1]

      const assistantMessage: Message = {
        role: 'assistant',
        content: lastMessage.content || lastMessage.kwargs?.content || 'No response',
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
                    <div className="text-sm whitespace-pre-wrap">
                      {message.content}
                    </div>
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

          <form onSubmit={handleSubmit} className="flex gap-2">
            <Input
              value={input}
              onChange={(e) => setInput(e.target.value)}
              placeholder="Type your message..."
              disabled={isLoading || !groupId}
              className="flex-1"
            />
            <Button type="submit" disabled={isLoading || !groupId}>
              Send
            </Button>
          </form>
        </CardContent>
      </Card>
    </div>
  )
}
