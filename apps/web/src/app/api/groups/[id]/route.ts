import { NextRequest, NextResponse } from 'next/server'
import { getUser } from '@/lib/supabase'
import { groupService } from '@/services/group.service'

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const user = await getUser()
    const { id } = await params

    if (!user) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      )
    }

    const groupId = parseInt(id)

    if (isNaN(groupId)) {
      return NextResponse.json(
        { error: 'Invalid group ID' },
        { status: 400 }
      )
    }

    const group = await groupService.getGroupById(groupId, user.id)

    return NextResponse.json({ group })
  } catch (error) {
    console.error('Get group error:', error)
    const message = error instanceof Error ? error.message : 'Internal server error'
    let status = 500
    if (message === 'You are not a member of this group') status = 403
    if (message === 'Group not found') status = 404
    return NextResponse.json(
      { error: message },
      { status }
    )
  }
}
