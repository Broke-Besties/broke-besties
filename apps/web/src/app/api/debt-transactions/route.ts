import { NextRequest, NextResponse } from 'next/server'
import { errorResponse } from '@/lib/api-error'
import { getUser } from '@/lib/supabase'
import { debtTransactionService } from '@/services/debt-transaction.service'

const ERROR_STATUS = new Map([
  ['Debt not found', 404],
  ['You are not authorized to create a transaction for this debt', 403],
  ['Modification must include at least one change (amount or description)', 400],
  ['Proposed amount must be positive', 400],
  ['There is already a pending transaction for this debt', 400],
])

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
      (await request.json().catch(() => null)) ?? {}

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
    return errorResponse(error, ERROR_STATUS)
  }
}
