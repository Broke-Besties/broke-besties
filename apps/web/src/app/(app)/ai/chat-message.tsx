'use client'

import type { ReactNode } from 'react'
import Link from 'next/link'
import { ArrowRight } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Spinner } from '@/components/ui/spinner'
import { cn } from '@/lib/utils'

export type ChatMessage = {
  role: 'user' | 'assistant' | 'system'
  content: string
  id?: string
  imageUrl?: string
  /** Set on the confirmation message after debts are created. */
  groupHref?: string
}

type ChatMessageBubbleProps = {
  message: ChatMessage
  /** Assignment/review panel rendered full width inside the bubble. */
  reviewPanel?: ReactNode
}

export function ChatMessageBubble({ message, reviewPanel }: ChatMessageBubbleProps) {
  const isUser = message.role === 'user'

  return (
    <div className={cn('flex', isUser ? 'justify-end' : 'justify-start')}>
      <div
        className={cn(
          'rounded-lg px-3 py-2 sm:px-4',
          isUser ? 'bg-primary text-primary-foreground' : 'bg-muted',
          reviewPanel ? 'w-full' : 'max-w-[80%] sm:max-w-[85%]'
        )}
      >
        <div className="mb-1 text-sm font-semibold">
          {isUser ? 'You' : 'Assistant'}
        </div>
        {message.imageUrl && (
          <img
            src={message.imageUrl}
            alt="Uploaded receipt"
            className="mb-2 max-h-64 max-w-full rounded-md object-contain"
          />
        )}
        <div className="text-sm whitespace-pre-wrap">{message.content}</div>
        {message.groupHref && (
          <div className="mt-3">
            <Button asChild size="sm" variant="outline">
              <Link href={message.groupHref}>
                View group
                <ArrowRight />
              </Link>
            </Button>
          </div>
        )}
        {reviewPanel && <div className="mt-3">{reviewPanel}</div>}
      </div>
    </div>
  )
}

export function ThinkingBubble({ label }: { label?: string }) {
  return (
    <div className="flex justify-start">
      <div className="rounded-lg bg-muted px-3 py-2 sm:px-4">
        <div className="mb-1 text-sm font-semibold">Assistant</div>
        <div className="flex items-center gap-2 text-sm text-muted-foreground">
          <Spinner />
          {label || 'Thinking…'}
        </div>
      </div>
    </div>
  )
}
