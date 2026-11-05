import { prisma } from '@/lib/prisma'
import { User } from '@prisma/client'

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

  /**
   * Find a user by email without throwing when absent.
   */
  async findByEmail(email: string) {
    if (!email) {
      throw new Error('Email parameter is required')
    }

    return prisma.user.findUnique({
      where: { email: email.trim().toLowerCase() },
    })
  }

  /**
   * Find a user by email, or create a placeholder row (signedUp = false) when
   * no user exists yet. Placeholders let a user track debts / friendships with
   * someone who hasn't signed up; the auth trigger adopts the row on signup.
   */
  async findOrCreatePlaceholderByEmail(email: string) {
    if (!email) {
      throw new Error('Email parameter is required')
    }

    const normalized = email.trim().toLowerCase()

    const existing = await prisma.user.findUnique({
      where: { email: normalized },
    })

    if (existing) {
      return existing
    }

    return prisma.user.create({
      data: {
        email: normalized,
        name: normalized.split('@')[0],
        signedUp: false,
      },
    })
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
