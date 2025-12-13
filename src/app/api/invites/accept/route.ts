import { NextRequest, NextResponse } from 'next/server'
import { getUser } from '@/lib/supabase'
import { prisma } from '@/lib/prisma'

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

    // Get the invite
    const invite = await prisma.groupInvite.findUnique({
      where: { id: inviteId },
    })

    if (!invite) {
      return NextResponse.json(
        { error: 'Invite not found' },
        { status: 404 }
      )
    }

    // Check if the invite is for the current user
    if (invite.invitedEmail !== user.email) {
      return NextResponse.json(
        { error: 'This invite is not for you' },
        { status: 403 }
      )
    }

    // Check if invite is still pending
    if (invite.status !== 'pending') {
      return NextResponse.json(
        { error: 'This invite has already been processed' },
        { status: 400 }
      )
    }

    // Add user to group and update invite status
    const [member] = await prisma.$transaction([
      prisma.groupMember.create({
        data: {
          userId: user.id,
          groupId: invite.groupId,
        },
        include: {
          group: true,
        },
      }),
      prisma.groupInvite.update({
        where: { id: inviteId },
        data: { status: 'accepted' },
      }),
    ])

    return NextResponse.json({
      message: 'Invite accepted successfully',
      group: member.group,
    })
  } catch (error) {
    console.error('Accept invite error:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}
