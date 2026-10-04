import { NextRequest, NextResponse } from 'next/server'
import { errorResponse } from '@/lib/api-error'
import { getUser } from '@/lib/supabase'
import { debtTransactionService } from '@/services/debt-transaction.service'

// PATCH and DELETE: the known service messages keep their status, anything else is a 500.
const ERROR_STATUS = new Map([
  ['Transaction not found', 404],
  ['You are not authorized to respond to this transaction', 403],
  ['Only the requester can cancel this transaction', 403],
  ['This transaction has already been processed', 400],
])

// GET /api/debt-transactions/[id] - Get a specific transaction
export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const user = await getUser()
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { id } = await params
    const transactionId = parseInt(id)

    if (isNaN(transactionId)) {
      return NextResponse.json(
        { error: 'Invalid transaction ID' },
        { status: 400 }
      )
    }

    const transaction = await debtTransactionService.getTransactionById(
      transactionId,
      user.id
    )
    return NextResponse.json({ transaction })
  } catch (error) {
    console.error('Error fetching transaction:', error)
    const message =
      error instanceof Error ? error.message : 'Internal server error'
    const status = message.includes('not found')
      ? 404
      : message.includes('access')
        ? 403
        : 500
    return NextResponse.json({ error: message }, { status })
  }
}

// PATCH /api/debt-transactions/[id] - Respond to a transaction (approve/reject)
export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const user = await getUser()
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { id } = await params
    const transactionId = parseInt(id)

    if (isNaN(transactionId)) {
      return NextResponse.json(
        { error: 'Invalid transaction ID' },
        { status: 400 }
      )
    }

    const { approve } = (await request.json().catch(() => null)) ?? {}

    if (typeof approve !== 'boolean') {
      return NextResponse.json(
        { error: 'approve must be a boolean' },
        { status: 400 }
      )
    }

    const result = await debtTransactionService.respondToTransaction({
      transactionId,
      userId: user.id,
      approve,
    })

    return NextResponse.json(result)
  } catch (error) {
    console.error('Error responding to transaction:', error)
    return errorResponse(error, ERROR_STATUS)
  }
}

// DELETE /api/debt-transactions/[id] - Cancel a transaction
export async function DELETE(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const user = await getUser()
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { id } = await params
    const transactionId = parseInt(id)

    if (isNaN(transactionId)) {
      return NextResponse.json(
        { error: 'Invalid transaction ID' },
        { status: 400 }
      )
    }

    await debtTransactionService.cancelTransaction(transactionId, user.id)
    return NextResponse.json({ message: 'Transaction cancelled' })
  } catch (error) {
    console.error('Error cancelling transaction:', error)
    return errorResponse(error, ERROR_STATUS)
  }
}
