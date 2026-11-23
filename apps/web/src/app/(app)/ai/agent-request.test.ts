import { describe, expect, it } from 'vitest'
import { buildAgentRequest } from './agent-request'
import type { ChatMessage } from './chat-message'

const receiptMessage: ChatMessage = {
  role: 'user',
  content: 'Analyze this receipt',
  imageUrl: 'https://example.com/test-receipt.png',
}

const clarification: ChatMessage[] = [
  receiptMessage,
  { role: 'assistant', content: 'Who had the pizza and salad?' },
  { role: 'user', content: 'Bob had pizza. Daniel had salad.' },
]

describe('AI receipt requests', () => {
  it('retains the pending receipt when answering a clarification', () => {
    const request = buildAgentRequest(clarification, '7', 'receipt-1')

    expect(request).toEqual({
      messages: [
        { type: 'human', content: 'Analyze this receipt' },
        { type: 'ai', content: 'Who had the pizza and salad?' },
        { type: 'human', content: 'Bob had pizza. Daniel had salad.' },
      ],
      groupId: 7,
      imageUrl: receiptMessage.imageUrl,
      receiptIds: ['receipt-1'],
    })
  })

  it('uses a newly uploaded receipt instead of an earlier one', () => {
    const request = buildAgentRequest([
      ...clarification,
      { ...receiptMessage, imageUrl: 'https://example.com/new-receipt.png' },
    ], '7', 'receipt-2')

    expect(request.imageUrl).toBe('https://example.com/new-receipt.png')
    expect(request.receiptIds).toEqual(['receipt-2'])
  })

  it('does not reuse a receipt after review is saved or cancelled', () => {
    const request = buildAgentRequest(clarification, '7', null)

    expect(request.imageUrl).toBeNull()
    expect(request.receiptIds).toBeUndefined()
  })

  it('omits the group when the MCP flow has none selected', () => {
    const request = buildAgentRequest(clarification, null, null)

    expect(request.groupId).toBeNull()
  })
})
