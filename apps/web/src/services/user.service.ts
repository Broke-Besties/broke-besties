import { prisma } from '@/lib/prisma'

export class UserService {
  /**
   * Get user by ID
   */
  async getUserById(userId: string) {
    const user = await prisma.user.findUnique({
      where: { id: userId },
    })

    if (!user) {
      throw new Error('User not found')
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
}

export const userService = new UserService()
