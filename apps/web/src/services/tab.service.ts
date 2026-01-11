import { prisma } from '@/lib/prisma'
import { TabPolicy } from '@/policies/tab.policy'

type CreateTabParams = {
  amount: number
  description: string
  personName: string
  userId: string
  status?: 'lending' | 'borrowing'
}

type UpdateTabParams = {
  amount?: number
  description?: string
  personName?: string
  status?: string
}

type GetTabsFilters = {
  status?: string | null
}

export class TabService {
  /**
   * Create a new tab
   */
  async createTab(params: CreateTabParams) {
    const { amount, description, personName, userId, status = 'borrowing' } = params

    if (!amount || amount <= 0) {
      throw new Error('Valid amount is required')
    }

    if (!description || description.trim() === '') {
      throw new Error('Description is required')
    }

    if (!personName || personName.trim() === '') {
      throw new Error('Person name is required')
    }

    if (!TabPolicy.isValidStatus(status)) {
      throw new Error('Invalid status value')
    }

    const tab = await prisma.tab.create({
      data: {
        amount,
        description: description.trim(),
        personName: personName.trim(),
        userId,
        status,
      },
    })

    return tab
  }

  /**
   * Get all tabs for a user with optional filters
   */
  async getUserTabs(userId: string, filters: GetTabsFilters = {}) {
    const { status } = filters

    const where: any = {
      userId,
    }

    if (status) {
      where.status = status
    }

    const tabs = await prisma.tab.findMany({
      where,
      orderBy: {
        createdAt: 'desc',
      },
    })

    return tabs
  }

  /**
   * Get a specific tab by ID
   */
  async getTabById(tabId: number, userId: string) {
    const tab = await prisma.tab.findUnique({
      where: { id: tabId },
    })

    if (!tab) {
      throw new Error('Tab not found')
    }

    if (!TabPolicy.canView(userId, tab)) {
      throw new Error("You don't have permission to view this tab")
    }

    return tab
  }

  /**
   * Update a tab
   */
  async updateTab(tabId: number, userId: string, updates: UpdateTabParams) {
    const { amount, description, personName, status } = updates

    const existingTab = await prisma.tab.findUnique({
      where: { id: tabId },
    })

    if (!existingTab) {
      throw new Error('Tab not found')
    }

    if (!TabPolicy.canUpdate(userId, existingTab)) {
      throw new Error("You don't have permission to update this tab")
    }

    const updateData: any = {}

    if (amount !== undefined) {
      if (amount <= 0) {
        throw new Error('Amount must be positive')
      }
      updateData.amount = amount
    }

    if (description !== undefined) {
      if (description.trim() === '') {
        throw new Error('Description cannot be empty')
      }
      updateData.description = description.trim()
    }

    if (personName !== undefined) {
      if (personName.trim() === '') {
        throw new Error('Person name cannot be empty')
      }
      updateData.personName = personName.trim()
    }

    if (status !== undefined) {
      if (!TabPolicy.isValidStatus(status)) {
        throw new Error('Invalid status value')
      }
      updateData.status = status
    }

    const tab = await prisma.tab.update({
      where: { id: tabId },
      data: updateData,
    })

    return tab
  }

  /**
   * Delete a tab
   */
  async deleteTab(tabId: number, userId: string) {
    const existingTab = await prisma.tab.findUnique({
      where: { id: tabId },
    })

    if (!existingTab) {
      throw new Error('Tab not found')
    }

    if (!TabPolicy.canDelete(userId, existingTab)) {
      throw new Error("You don't have permission to delete this tab")
    }

    await prisma.tab.delete({
      where: { id: tabId },
    })
  }
}

export const tabService = new TabService()
