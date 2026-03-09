import { getUser } from "@/lib/supabase";
import { friendService } from "@/services/friend.service";
import { prisma } from "@/lib/prisma";
import { redirect } from "next/navigation";
import { FriendsPage } from "@/components/friends/friends-page";

const MOCK_SUGGESTIONS = [
  {
    id: 1,
    name: "Tina Park",
    handle: "@tinapark",
    email: "tina@example.com",
    avatar: "https://api.dicebear.com/9.x/notionists/svg?seed=tina&backgroundColor=0f1923",
    initials: "TP",
    mutuals: 3,
  },
  {
    id: 2,
    name: "Luis Morales",
    handle: "@luism",
    email: "luis@example.com",
    avatar: "https://api.dicebear.com/9.x/notionists/svg?seed=luis&backgroundColor=1a1a2e",
    initials: "LM",
    mutuals: 5,
  },
  {
    id: 3,
    name: "Nadia Osei",
    handle: "@nadiaosei",
    email: "nadia@example.com",
    avatar: "https://api.dicebear.com/9.x/notionists/svg?seed=nadia&backgroundColor=1e0a0a",
    initials: "NO",
    mutuals: 8,
  },
  {
    id: 4,
    name: "Riku Tanaka",
    handle: "@rikut",
    email: "riku@example.com",
    avatar: "https://api.dicebear.com/9.x/notionists/svg?seed=riku&backgroundColor=0a1a0a",
    initials: "RT",
    mutuals: 2,
  },
  {
    id: 5,
    name: "Fiona Walsh",
    handle: "@fionaw",
    email: "fiona@example.com",
    avatar: "https://api.dicebear.com/9.x/notionists/svg?seed=fiona&backgroundColor=1e1b2e",
    initials: "FW",
    mutuals: 6,
  },
  {
    id: 6,
    name: "Zach Obi",
    handle: "@zachobi",
    email: "zach@example.com",
    avatar: "https://api.dicebear.com/9.x/notionists/svg?seed=zach&backgroundColor=1a0f0f",
    initials: "ZO",
    mutuals: 1,
  },
];

export default async function Page() {
  const user = await getUser();

  if (!user) {
    redirect("/login");
  }

  const [friends, pendingRequests, sentRequests, groupCount] = await Promise.all([
    friendService.getFriends(user.id),
    friendService.getPendingRequests(user.id),
    friendService.getSentRequests(user.id),
    prisma.groupMember.count({ where: { userId: user.id } }),
  ]);

  return (
    <FriendsPage
      friends={friends}
      pendingRequests={pendingRequests}
      sentRequests={sentRequests}
      groupCount={groupCount}
      suggestions={MOCK_SUGGESTIONS}
    />
  );
}
