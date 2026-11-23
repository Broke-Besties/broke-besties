import type { ChatMessage } from './chat-message'

export function buildAgentRequest(
  messages: ChatMessage[],
  groupId: string | null,
  receiptId: string | null,
) {
  const parsedGroupId = groupId ? Number.parseInt(groupId, 10) : null

  return {
    messages: messages.map(message => ({
      type: message.role === 'user' ? 'human' : 'ai',
      content: message.content,
    })),
    groupId: parsedGroupId !== null && Number.isFinite(parsedGroupId)
      ? parsedGroupId
      : null,
    imageUrl: receiptId
      ? messages.findLast(message => message.role === 'user' && message.imageUrl)?.imageUrl ?? null
      : null,
    receiptIds: receiptId ? [receiptId] : undefined,
  }
}
