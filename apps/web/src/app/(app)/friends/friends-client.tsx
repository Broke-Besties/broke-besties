"use client";

import { useEffect, useState } from "react";
import { UserPlus } from "lucide-react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { toast } from "sonner";

import { PageHeader } from "@/components/page-header";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  sendFriendRequestByEmail,
  acceptFriendRequest,
  rejectFriendRequest,
  removeFriend,
  cancelFriendRequest,
} from "./actions";
import { AddFriendDialog } from "./add-friend-dialog";
import { FriendsList } from "./friends-list";
import { RequestsList } from "./requests-list";
import type { Friend, FriendRequest, PendingAction } from "./types";

type FriendsPageClientProps = {
  initialFriends: Friend[];
  initialPendingRequests: FriendRequest[];
  initialSentRequests: FriendRequest[];
};

type Tab = "friends" | "requests";

export default function FriendsPageClient({
  initialFriends,
  initialPendingRequests,
  initialSentRequests,
}: FriendsPageClientProps) {
  const [friends, setFriends] = useState<Friend[]>(initialFriends);
  const [pendingRequests, setPendingRequests] =
    useState<FriendRequest[]>(initialPendingRequests);
  const [sentRequests, setSentRequests] =
    useState<FriendRequest[]>(initialSentRequests);
  const [pending, setPending] = useState<PendingAction | null>(null);
  const [addOpen, setAddOpen] = useState(false);
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();

  const activeTab: Tab =
    searchParams.get("tab") === "requests" ? "requests" : "friends";

  // /friends?new=1 (command palette, empty-state deep links) opens the dialog.
  useEffect(() => {
    if (searchParams.get("new") === "1") {
      setAddOpen(true);
    }
  }, [searchParams]);

  const replaceQuery = (mutate: (params: URLSearchParams) => void) => {
    const params = new URLSearchParams(searchParams.toString());
    mutate(params);
    const query = params.toString();
    router.replace(query ? `${pathname}?${query}` : pathname, {
      scroll: false,
    });
  };

  const handleTabChange = (value: string) => {
    replaceQuery((params) => {
      if (value === "requests") {
        params.set("tab", "requests");
      } else {
        params.delete("tab");
      }
    });
  };

  const handleAddOpenChange = (open: boolean) => {
    setAddOpen(open);
    if (!open && searchParams.get("new") === "1") {
      replaceQuery((params) => params.delete("new"));
    }
  };

  const handleAccept = async (requestId: number) => {
    setPending({ id: requestId, action: "accept" });
    try {
      const result = await acceptFriendRequest(requestId);
      if (!result.success) {
        toast.error(result.error || "Failed to accept request");
        return;
      }
      setPendingRequests((prev) => prev.filter((r) => r.id !== requestId));
      if (result.friend) {
        setFriends((prev) => [
          ...prev,
          { ...result.friend, friend: result.friend.requester },
        ]);
      }
      toast.success("Friend request accepted");
    } catch {
      toast.error("An error occurred");
    } finally {
      setPending(null);
    }
  };

  const handleReject = async (requestId: number) => {
    setPending({ id: requestId, action: "reject" });
    try {
      const result = await rejectFriendRequest(requestId);
      if (!result.success) {
        toast.error(result.error || "Failed to reject request");
        return;
      }
      setPendingRequests((prev) => prev.filter((r) => r.id !== requestId));
      toast.success("Friend request rejected");
    } catch {
      toast.error("An error occurred");
    } finally {
      setPending(null);
    }
  };

  const handleCancel = async (requestId: number) => {
    setPending({ id: requestId, action: "cancel" });
    try {
      const result = await cancelFriendRequest(requestId);
      if (!result.success) {
        toast.error(result.error || "Failed to cancel request");
        return;
      }
      setSentRequests((prev) => prev.filter((r) => r.id !== requestId));
      toast.success("Friend request cancelled");
    } catch {
      toast.error("An error occurred");
    } finally {
      setPending(null);
    }
  };

  const handleRemove = async (friendshipId: number) => {
    setPending({ id: friendshipId, action: "remove" });
    try {
      const result = await removeFriend(friendshipId);
      if (!result.success) {
        toast.error(result.error || "Failed to remove friend");
        return;
      }
      setFriends((prev) => prev.filter((f) => f.id !== friendshipId));
      toast.success("Friend removed");
    } catch {
      toast.error("An error occurred");
    } finally {
      setPending(null);
    }
  };

  const handleAddFriend = async (email: string): Promise<boolean> => {
    try {
      const result = await sendFriendRequestByEmail(email);
      if (!result.success) {
        toast.error(result.error || "Failed to add friend");
        return false;
      }
      if (result.autoAccepted && result.friend) {
        setFriends((prev) => [
          ...prev,
          { ...result.friend, friend: result.friend.requester },
        ]);
        toast.success("You are now friends");
      } else if (result.friend) {
        setSentRequests((prev) => [result.friend, ...prev]);
        toast.success("Friend request sent");
      }
      return true;
    } catch {
      toast.error("An error occurred");
      return false;
    }
  };

  return (
    <div className="space-y-6">
      <PageHeader
        title="Friends"
        description="Manage your friends and friend requests."
        actions={
          <Button onClick={() => setAddOpen(true)}>
            <UserPlus />
            Add friend
          </Button>
        }
      />

      <Tabs value={activeTab} onValueChange={handleTabChange}>
        <TabsList>
          <TabsTrigger value="friends">
            Friends
            {friends.length > 0 && (
              <Badge variant="secondary">{friends.length}</Badge>
            )}
          </TabsTrigger>
          <TabsTrigger value="requests">
            Requests
            {pendingRequests.length > 0 && (
              <Badge variant="secondary">{pendingRequests.length}</Badge>
            )}
          </TabsTrigger>
        </TabsList>

        <TabsContent value="friends">
          <FriendsList
            friends={friends}
            pending={pending}
            onRemove={handleRemove}
            onAddFriend={() => setAddOpen(true)}
          />
        </TabsContent>

        <TabsContent value="requests">
          <RequestsList
            pendingRequests={pendingRequests}
            sentRequests={sentRequests}
            pending={pending}
            onAccept={handleAccept}
            onReject={handleReject}
            onCancel={handleCancel}
          />
        </TabsContent>
      </Tabs>

      <AddFriendDialog
        open={addOpen}
        onOpenChange={handleAddOpenChange}
        onSubmit={handleAddFriend}
      />
    </div>
  );
}
