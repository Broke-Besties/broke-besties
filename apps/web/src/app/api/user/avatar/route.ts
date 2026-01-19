import { NextResponse } from 'next/server'
import { getUser } from '@/lib/supabase'
import { avatarService } from '@/services/avatar.service'

// POST /api/user/avatar - Upload profile picture
export async function POST(request: Request) {
  try {
    const user = await getUser()
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const formData = await request.formData()
    const file = formData.get('file') as File | null

    if (!file) {
      return NextResponse.json({ error: 'No file provided' }, { status: 400 })
    }

    const publicUrl = await avatarService.uploadAvatar(user.id, file)

    return NextResponse.json({ url: publicUrl })
  } catch (error) {
    console.error('Error uploading avatar:', error)
    const message = error instanceof Error ? error.message : 'Failed to upload avatar'
    return NextResponse.json({ error: message }, { status: 500 })
  }
}

// DELETE /api/user/avatar - Remove profile picture
export async function DELETE() {
  try {
    const user = await getUser()
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    await avatarService.deleteAvatar(user.id)

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error('Error deleting avatar:', error)
    const message = error instanceof Error ? error.message : 'Failed to delete avatar'
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
