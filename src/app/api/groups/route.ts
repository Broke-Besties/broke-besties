import { NextRequest, NextResponse } from 'next/server'
import { getUser } from '@/lib/supabase'
import { groupService } from '@/services/group.service'

// Create a new group
export async function POST(request: NextRequest) {
  try {
    const user = await getUser()

    if (!user) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      )
    }

    const { name } = await request.json()

    const group = await groupService.createGroup(user.id, name)

    return NextResponse.json({
      message: 'Group created successfully',
      group,
    })
  } catch (error) {
    console.error('Create group error:', error)
    const message = error instanceof Error ? error.message : 'Internal server error'
    const status = error instanceof Error && error.message === 'Group name is required' ? 400 : 500
    return NextResponse.json(
      { error: message },
      { status }
    )
  }
}

// Get user's groups
export async function GET() {
  try {
    const user = await getUser()

    if (!user) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      )
    }

    const groups = await groupService.getUserGroups(user.id)

    return NextResponse.json({ groups })
  } catch (error) {
    console.error('Get groups error:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}
