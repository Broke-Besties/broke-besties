import { NextRequest, NextResponse } from 'next/server'
import { getUser } from '@/lib/supabase'
import { inviteService } from '@/services/invite.service'

// Create an invite
export async function POST(request: NextRequest) {
  try {
    const user = await getUser()

    if (!user) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      )
    }

    const { groupId, invitedEmail } = await request.json()

    const invite = await inviteService.createInvite(user.id, groupId, invitedEmail)

    return NextResponse.json({
      message: 'Invite sent successfully',
      invite,
    })
  } catch (error) {
    console.error('Create invite error:', error)
    const message = error instanceof Error ? error.message : 'Internal server error'
    let status = 500
    if (
      message === 'Group ID and invited email are required' ||
      message === 'Invite already exists for this email' ||
      message === 'User is already a member of this group'
    ) {
      status = 400
    }
    if (message === 'You are not a member of this group') status = 403
    return NextResponse.json({ error: message }, { status })
  }
}

// Get pending invites for current user
export async function GET() {
  try {
    const user = await getUser()

    if (!user) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      )
    }

    const invites = await inviteService.getUserInvites(user.email!)

    return NextResponse.json({ invites })
  } catch (error) {
    console.error('Get invites error:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}
