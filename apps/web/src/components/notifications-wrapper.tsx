import { getUser } from "@/lib/supabase";
import { notificationService } from "@/services/notification.service";
import { NotificationsDropdown } from "./notifications-dropdown";

export async function NotificationsWrapper() {
  const user = await getUser();

  if (!user) {
    return null;
  }

  const [notifications, unreadCount] = await Promise.all([
    notificationService.list(user.id),
    notificationService.unreadCount(user.id),
  ]);

  return (
    <NotificationsDropdown
      notifications={notifications}
      unreadCount={unreadCount}
      currentUserId={user.id}
    />
  );
}
