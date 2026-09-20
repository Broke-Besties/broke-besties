"use server";

import { getUser } from "@/lib/supabase";
import { notificationService } from "@/services/notification.service";

export async function markNotificationRead(id: string) {
  const user = await getUser();
  if (!user) return { success: false };
  await notificationService.markRead(id, user.id);
  return { success: true };
}

export async function markAllNotificationsRead() {
  const user = await getUser();
  if (!user) return { success: false };
  await notificationService.markAllRead(user.id);
  return { success: true };
}
