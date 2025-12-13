import { NextRequest, NextResponse } from 'next/server'
import { getUser } from '@/lib/supabase'
import { prisma } from '@/lib/prisma'

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

    if (!groupId || !invitedEmail) {
      return NextResponse.json(
        { error: 'Group ID and invited email are required' },
        { status: 400 }
      )
    }

    // Check if user is a member of the group
    const membership = await prisma.groupMember.findFirst({
      where: {
        groupId,
        userId: user.id,
      },
    })

    if (!membership) {
      return NextResponse.json(
        { error: 'You are not a member of this group' },
        { status: 403 }
      )
    }

    // Check if invite already exists
    const existingInvite = await prisma.groupInvite.findUnique({
      where: {
        groupId_invitedEmail: {
          groupId,
          invitedEmail,
        },
      },
    })

    if (existingInvite) {
      return NextResponse.json(
        { error: 'Invite already exists for this email' },
        { status: 400 }
      )
    }

    // Check if user is already a member
    const existingMember = await prisma.user.findUnique({
      where: { email: invitedEmail },
      include: {
        members: {
          where: { groupId },
        },
      },
    })

    if (existingMember && existingMember.members.length > 0) {
      return NextResponse.json(
        { error: 'User is already a member of this group' },
        { status: 400 }
      )
    }

    // Create invite
    const invite = await prisma.groupInvite.create({
      data: {
        groupId,
        invitedBy: user.id,
        invitedEmail,
      },
      include: {
        group: true,
        sender: true,
      },
    })

    return NextResponse.json({
      message: 'Invite sent successfully',
      invite,
    })
  } catch (error) {
    console.error('Create invite error:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
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

    const invites = await prisma.groupInvite.findMany({
      where: {
        invitedEmail: user.email!,
        status: 'pending',
      },
      include: {
        group: {
          include: {
            members: {
              include: {
                user: true,
              },
            },
          },
        },
        sender: true,
      },
    })

    return NextResponse.json({ invites })
  } catch (error) {
    console.error('Get invites error:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}
