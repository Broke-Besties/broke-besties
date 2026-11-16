'use client'

import type { ReactNode } from 'react'
import Link from 'next/link'
import Image from 'next/image'
import { ArrowRight, CheckCheck, Sparkles } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Bubble, BubbleContent } from '@/components/ui/bubble'
import { Message, MessageContent, MessageHeader } from '@/components/ui/message'
import { Spinner } from '@/components/ui/spinner'

export type ChatMessage = {
  role: 'user' | 'assistant' | 'system'
  content: string
  id?: string
  imageUrl?: string
  groupHref?: string
}

type ChatMessageBubbleProps = {
  message: ChatMessage
  reviewPanel?: ReactNode
}

export function ChatMessageBubble({
  message,
  reviewPanel,
}: ChatMessageBubbleProps) {
  const isUser = message.role === 'user'

  return (
    <Message align={isUser ? 'end' : 'start'}>
      <MessageContent>
        <MessageHeader className="gap-1.5">
          {!isUser &&
            (message.groupHref ? (
              <CheckCheck className="size-3.5" />
            ) : (
              <Sparkles className="size-3.5" />
            ))}
          {isUser ? 'You' : 'Broke Besties'}
        </MessageHeader>
        <Bubble variant={isUser ? 'secondary' : 'ghost'}>
          <BubbleContent>
            {message.imageUrl && (
              <a
                href={message.imageUrl}
                target="_blank"
                rel="noreferrer"
                aria-label="Open uploaded receipt"
              >
                <Image
                  src={message.imageUrl}
                  alt="Uploaded receipt"
                  width={320}
                  height={448}
                  unoptimized
                  className="mb-3 h-auto max-h-56 w-auto max-w-full rounded-lg object-contain"
                />
              </a>
            )}
            <p className="whitespace-pre-wrap">{message.content}</p>
          </BubbleContent>
        </Bubble>
        {reviewPanel}
        {message.groupHref && (
          <Button asChild size="sm" variant="outline" className="w-fit">
            <Link href={message.groupHref}>
              View group
              <ArrowRight data-icon="inline-end" />
            </Link>
          </Button>
        )}
      </MessageContent>
    </Message>
  )
}

export function ThinkingBubble({ label = 'Thinking…' }: { label?: string }) {
  return (
    <Message>
      <MessageContent>
        <MessageHeader>Broke Besties</MessageHeader>
        <Bubble variant="ghost">
          <BubbleContent>
            <div
              role="status"
              className="flex items-center gap-2 text-muted-foreground"
            >
              <Spinner />
              {label}
            </div>
          </BubbleContent>
        </Bubble>
      </MessageContent>
    </Message>
  )
}
