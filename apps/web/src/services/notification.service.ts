import { prisma } from "@/lib/prisma";

export type CreateNotificationParams = {
  userId: string;
  type: string;
  title: string;
  body?: string | null;
  link?: string | null;
};

export class NotificationService {
  /**
   * Create an in-app notification for a recipient. Writes go through Prisma
   * (direct postgres connection, bypasses RLS); Supabase Realtime then delivers
   * the INSERT to the recipient's browser, scoped by the RLS SELECT policy.
   *
   * Never throws into the caller's flow — a failed notification must not break
   * the underlying action (debt creation, friend request, etc.).
   */
  async create(params: CreateNotificationParams) {
    try {
      return await prisma.notification.create({
        data: {
          userId: params.userId,
          type: params.type,
          title: params.title,
          body: params.body ?? null,
          link: params.link ?? null,
        },
      });
    } catch (error) {
      console.error("[NotificationService] Failed to create notification:", error);
      return null;
    }
  }

  async list(userId: string, limit = 30) {
    return prisma.notification.findMany({
      where: { userId },
      orderBy: { createdAt: "desc" },
      take: limit,
    });
  }

  async unreadCount(userId: string) {
    return prisma.notification.count({ where: { userId, read: false } });
  }

  async markRead(id: string, userId: string) {
    // Scope by userId so a user can only mark their own notifications.
    return prisma.notification.updateMany({
      where: { id, userId },
      data: { read: true },
    });
  }

  async markAllRead(userId: string) {
    return prisma.notification.updateMany({
      where: { userId, read: false },
      data: { read: true },
    });
  }
}

export const notificationService = new NotificationService();
