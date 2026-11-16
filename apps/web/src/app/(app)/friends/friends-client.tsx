"use client";

import { useEffect, useRef, useState } from "react";
import { UserPlus } from "lucide-react";
import { usePathname, useSearchParams } from "next/navigation";
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
import { AddFriendDialog, type AddFriendResult } from "./add-friend-dialog";
import { FriendsList } from "./friends-list";
import { RequestsList } from "./requests-list";
import type { Friend, FriendRequest, PendingAction } from "./types";

type FriendsPageClientProps = {
  currentUserId: string;
  initialFriends: Friend[];
  initialPendingRequests: FriendRequest[];
  initialSentRequests: FriendRequest[];
};

type Tab = "friends" | "requests";

export default function FriendsPageClient({
  currentUserId,
  initialFriends,
  initialPendingRequests,
  initialSentRequests,
}: FriendsPageClientProps) {
  const [friends, setFriends] = useState<Friend[]>(initialFriends);
  const [pendingRequests, setPendingRequests] = useState<FriendRequest[]>(
    initialPendingRequests,
  );
  const [sentRequests, setSentRequests] =
    useState<FriendRequest[]>(initialSentRequests);
  const [pending, setPending] = useState<PendingAction | null>(null);
  const [addOpen, setAddOpen] = useState(false);
  const mutationPending = useRef(false);
  const headerButton = useRef<HTMLButtonElement>(null);
  const openingButton = useRef<HTMLElement | null>(null);
  const openAddFriend = (event: React.MouseEvent<HTMLButtonElement>) => {
    openingButton.current = event.currentTarget;
    setAddOpen(true);
  };
  const pathname = usePathname();
  const searchParams = useSearchParams();

  const activeTab: Tab =
    searchParams.get("tab") === "requests" ? "requests" : "friends";

  // /friends?new=1 (command palette, empty-state deep links) opens the dialog.
  useEffect(() => {
    if (searchParams.get("new") === "1") {
      openingButton.current = null;
      setAddOpen(true);
    }
  }, [searchParams]);

  const replaceQuery = (mutate: (params: URLSearchParams) => void) => {
    const params = new URLSearchParams(searchParams.toString());
    mutate(params);
    const query = params.toString();
    window.history.replaceState(
      null,
      "",
      query ? `${pathname}?${query}` : pathname,
    );
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
    if (mutationPending.current) return;
    mutationPending.current = true;
    setPending({ id: requestId, action: "accept" });
    try {
      const result = await acceptFriendRequest(requestId);
      if (!result.success) {
        toast.error(result.error || "Failed to accept request");
        return;
      }
      setPendingRequests((prev) => prev.filter((r) => r.id !== requestId));
      if (result.friend) {
        const accepted = result.friend;
        setFriends((prev) => [
          {
            ...accepted,
            friend:
              accepted.requesterId === currentUserId
                ? accepted.recipient
                : accepted.requester,
          },
          ...prev.filter((f) => f.id !== accepted.id),
        ]);
      }
      toast.success("Friend request accepted");
    } catch {
      toast.error("An error occurred");
    } finally {
      mutationPending.current = false;
      setPending(null);
    }
  };

  const handleReject = async (requestId: number) => {
    if (mutationPending.current) return;
    mutationPending.current = true;
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
      mutationPending.current = false;
      setPending(null);
    }
  };

  const handleCancel = async (requestId: number) => {
    if (mutationPending.current) return;
    mutationPending.current = true;
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
      mutationPending.current = false;
      setPending(null);
    }
  };

  const handleRemove = async (friendshipId: number) => {
    if (mutationPending.current) return;
    mutationPending.current = true;
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
      mutationPending.current = false;
      setPending(null);
    }
  };

  const handleAddFriend = async (email: string): Promise<AddFriendResult> => {
    if (mutationPending.current)
      return {
        success: false,
        error: "Please wait for the current action to finish.",
      };
    mutationPending.current = true;
    try {
      const result = await sendFriendRequestByEmail(email);
      if (!result.success) {
        return {
          success: false,
          error: result.error || "Failed to add friend",
        };
      }
      if (result.friend) {
        if (result.autoAccepted) {
          const otherUser =
            result.friend.requesterId === currentUserId
              ? result.friend.recipient
              : result.friend.requester;
          const accepted = result.friend;
          setPendingRequests((prev) =>
            prev.filter((r) => r.id !== accepted.id),
          );
          setSentRequests((prev) => prev.filter((r) => r.id !== accepted.id));
          setFriends((prev) => [
            { ...accepted, friend: otherUser },
            ...prev.filter((f) => f.id !== accepted.id),
          ]);
          toast.success(
            result.notSignedUp
              ? "Friend added - they'll be connected once they sign up"
              : "You are now friends",
          );
        } else {
          setSentRequests((prev) => [
            result.friend,
            ...prev.filter((r) => r.id !== result.friend.id),
          ]);
          toast.success("Friend request sent");
        }
      }
      return { success: true };
    } catch {
      return { success: false, error: "An error occurred. Please try again." };
    } finally {
      mutationPending.current = false;
    }
  };

  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        title="Friends"
        description="Manage your friends and friend requests."
        actions={
          <Button
            ref={headerButton}
            disabled={pending !== null}
            onClick={openAddFriend}
          >
            <UserPlus />
            Add friend
          </Button>
        }
      />

      <Tabs value={activeTab} onValueChange={handleTabChange}>
        <TabsList aria-label="Friends and requests">
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
            onAddFriend={openAddFriend}
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
        onCloseAutoFocus={(event) => {
          event.preventDefault();
          const target = openingButton.current;
          (target?.isConnected && !target.matches(":disabled")
            ? target
            : headerButton.current
          )?.focus();
        }}
      />
    </div>
  );
}
