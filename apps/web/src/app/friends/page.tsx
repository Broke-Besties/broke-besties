import { getUser } from "@/lib/supabase";
import { friendService } from "@/services/friend.service";
import { redirect } from "next/navigation";
import FriendsPageClient from "./friends-client";

export default async function FriendsPage() {
  const user = await getUser();

  if (!user) {
    redirect("/login");
  }

  const [friends, pendingRequests, sentRequests] = await Promise.all([
    friendService.getFriends(user.id),
    friendService.getPendingRequests(user.id),
    friendService.getSentRequests(user.id),
  ]);

  return (
    <FriendsPageClient
      initialFriends={friends}
      initialPendingRequests={pendingRequests}
      initialSentRequests={sentRequests}
    />
  );
}
