import { NextRequest, NextResponse } from 'next/server'
import { getUser } from '@/lib/supabase'
import { debtTransactionService } from '@/services/debt-transaction.service'

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

    const { approve } = await request.json()

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
    const message =
      error instanceof Error ? error.message : 'Internal server error'
    const status = message.includes('not found')
      ? 404
      : message.includes('not authorized')
        ? 403
        : 400
    return NextResponse.json({ error: message }, { status })
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
    const message =
      error instanceof Error ? error.message : 'Internal server error'
    const status = message.includes('not found')
      ? 404
      : message.includes('Only the requester')
        ? 403
        : 400
    return NextResponse.json({ error: message }, { status })
  }
}
