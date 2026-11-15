import type { ChatMessage } from './chat-message'

export function buildAgentRequest(
  messages: ChatMessage[],
  groupId: string,
  receiptId: string | null,
) {
  return {
    messages: messages.map(message => ({
      type: message.role === 'user' ? 'human' : 'ai',
      content: message.content,
    })),
    groupId: parseInt(groupId),
    imageUrl: receiptId
      ? messages.findLast(message => message.role === 'user' && message.imageUrl)?.imageUrl ?? null
      : null,
    receiptIds: receiptId ? [receiptId] : undefined,
  }
}
