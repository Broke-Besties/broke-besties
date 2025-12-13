import { NextRequest, NextResponse } from 'next/server'
import { getUser } from '@/lib/supabase'
import { inviteService } from '@/services/invite.service'

export async function POST(request: NextRequest) {
  try {
    const user = await getUser()

    if (!user) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      )
    }

    const { inviteId } = await request.json()

    if (!inviteId) {
      return NextResponse.json(
        { error: 'Invite ID is required' },
        { status: 400 }
      )
    }

    const group = await inviteService.acceptInvite(user.id, user.email!, inviteId)

    return NextResponse.json({
      message: 'Invite accepted successfully',
      group,
    })
  } catch (error) {
    console.error('Accept invite error:', error)
    const message = error instanceof Error ? error.message : 'Internal server error'
    let status = 500
    if (message === 'Invite not found') status = 404
    if (message === 'This invite is not for you') status = 403
    if (message === 'This invite has already been processed') status = 400
    return NextResponse.json({ error: message }, { status })
  }
}
