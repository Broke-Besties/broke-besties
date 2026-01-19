import { prisma } from '@/lib/prisma'
import { User } from '@prisma/client'
import { avatarService } from '@/services/avatar.service'

export class UserService {
  /**
   * Get user by ID with resolved avatar URL
   */
  async getUserById(userId: string) {
    const user = await prisma.user.findUnique({
      where: { id: userId },
    })

    if (!user) {
      throw new Error('User not found')
    }

    // Resolve avatar file path to signed URL (skip if already a full URL from old data)
    if (user.profilePictureUrl && !user.profilePictureUrl.startsWith('http')) {
      const signedUrl = await avatarService.getSignedUrl(user.profilePictureUrl)
      return { ...user, profilePictureUrl: signedUrl }
    }

    return user
  }

  /**
   * Search for a user by email
   */
  async searchUserByEmail(email: string) {
    if (!email) {
      throw new Error('Email parameter is required')
    }

    const user = await prisma.user.findUnique({
      where: { email },
      select: {
        id: true,
        email: true,
      },
    })

    if (!user) {
      throw new Error('User not found')
    }

    return user
  }
  async updateUser(userId: string, data: Partial<User>) {
    const user = await prisma.user.update({
      where: { id: userId },
      data,
    })

    return user
  }
}

export const userService = new UserService()
