import { NextRequest, NextResponse } from 'next/server'
import { getUser } from '@/lib/supabase'
import { receiptService } from '@/services/receipt.service'

// POST /api/receipts/[id]/parse - Extract items + prices from a receipt image
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const user = await getUser()
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { id } = await params

    const result = await receiptService.parseReceiptItems(id, user.id)

    return NextResponse.json({
      success: true,
      data: result,
    })
  } catch (error) {
    console.error('Parse receipt error:', error)
    const message =
      error instanceof Error ? error.message : 'Internal server error'
    let status = 500
    if (message === 'Unauthorized') status = 401
    if (message === 'Receipt not found') status = 404
    if (message === 'Access denied') status = 403
    return NextResponse.json({ error: message }, { status })
  }
}
