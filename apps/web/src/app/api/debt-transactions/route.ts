import { NextRequest, NextResponse } from 'next/server'
import { getUser } from '@/lib/supabase'
import { debtTransactionService } from '@/services/debt-transaction.service'

// GET /api/debt-transactions - Get pending transactions for current user
export async function GET() {
  try {
    const user = await getUser()
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const transactions =
      await debtTransactionService.getUserPendingTransactions(user.id)
    return NextResponse.json({ transactions })
  } catch (error) {
    console.error('Error fetching transactions:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}

// POST /api/debt-transactions - Create a new transaction
export async function POST(request: NextRequest) {
  try {
    const user = await getUser()
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { debtId, type, proposedAmount, proposedDescription, reason } =
      await request.json()

    if (!debtId || !type) {
      return NextResponse.json(
        { error: 'debtId and type are required' },
        { status: 400 }
      )
    }

    if (type !== 'drop' && type !== 'modify' && type !== 'confirm_paid') {
      return NextResponse.json(
        { error: 'type must be "drop", "modify", or "confirm_paid"' },
        { status: 400 }
      )
    }

    const transaction = await debtTransactionService.createTransaction({
      debtId,
      type,
      requesterId: user.id,
      proposedAmount,
      proposedDescription,
      reason,
    })

    return NextResponse.json({ transaction }, { status: 201 })
  } catch (error) {
    console.error('Error creating transaction:', error)
    const message =
      error instanceof Error ? error.message : 'Internal server error'
    const status = message.includes('not authorized') ? 403 : 400
    return NextResponse.json({ error: message }, { status })
  }
}
