"use client";

import { useState } from "react";
import { ArrowLeft, UserPlus, Users } from "lucide-react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";

import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  Empty,
  EmptyContent,
  EmptyDescription,
  EmptyHeader,
  EmptyMedia,
  EmptyTitle,
} from "@/components/ui/empty";
import { Input } from "@/components/ui/input";
import {
  Item,
  ItemActions,
  ItemContent,
  ItemDescription,
  ItemGroup,
  ItemMedia,
  ItemTitle,
} from "@/components/ui/item";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  sendFriendRequestByEmail,
  acceptFriendRequest,
  rejectFriendRequest,
  removeFriend,
  cancelFriendRequest,
} from "./actions";

type User = {
  id: string;
  name: string;
  email: string;
};

type Friend = {
  id: number;
  requesterId: string;
  recipientId: string;
  status: string;
  createdAt: Date | string;
  requester: User;
  recipient: User;
  friend: User;
};

type FriendRequest = {
  id: number;
  requesterId: string;
  recipientId: string;
  status: string;
  createdAt: Date | string;
  requester: User;
  recipient: User;
};

type FriendsPageClientProps = {
  initialFriends: Friend[];
  initialPendingRequests: FriendRequest[];
  initialSentRequests: FriendRequest[];
};

type Tab = "friends" | "requests" | "add";

function initials(value: string): string {
  const parts = value.split(/[\s._-]+/).filter(Boolean);
  const letters = (parts[0]?.[0] ?? "") + (parts[1]?.[0] ?? "");
  return (letters || value.slice(0, 2)).toUpperCase();
}

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
  const [activeTab, setActiveTab] = useState<Tab>("friends");
  const [processingId, setProcessingId] = useState<number | null>(null);
  const [email, setEmail] = useState("");
  const [addLoading, setAddLoading] = useState(false);
  const router = useRouter();

  const handleAccept = async (requestId: number) => {
    setProcessingId(requestId);
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
      setProcessingId(null);
    }
  };

  const handleReject = async (requestId: number) => {
    setProcessingId(requestId);
    try {
      const result = await rejectFriendRequest(requestId);
      if (!result.success) {
        toast.error(result.error || "Failed to reject request");
        return;
      }
      setPendingRequests((prev) => prev.filter((r) => r.id !== requestId));
    } catch {
      toast.error("An error occurred");
    } finally {
      setProcessingId(null);
    }
  };

  const handleCancel = async (requestId: number) => {
    setProcessingId(requestId);
    try {
      const result = await cancelFriendRequest(requestId);
      if (!result.success) {
        toast.error(result.error || "Failed to cancel request");
        return;
      }
      setSentRequests((prev) => prev.filter((r) => r.id !== requestId));
    } catch {
      toast.error("An error occurred");
    } finally {
      setProcessingId(null);
    }
  };

  const handleRemove = async (friendshipId: number) => {
    setProcessingId(friendshipId);
    try {
      const result = await removeFriend(friendshipId);
      if (!result.success) {
        toast.error(result.error || "Failed to remove friend");
        return;
      }
      setFriends((prev) => prev.filter((f) => f.id !== friendshipId));
    } catch {
      toast.error("An error occurred");
    } finally {
      setProcessingId(null);
    }
  };

  const handleAddFriend = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email.trim()) return;

    setAddLoading(true);
    try {
      const result = await sendFriendRequestByEmail(email.trim());
      if (!result.success) {
        toast.error(result.error || "Failed to add friend");
        return;
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
      setEmail("");
    } catch {
      toast.error("An error occurred");
    } finally {
      setAddLoading(false);
    }
  };

  const totalRequests = pendingRequests.length + sentRequests.length;

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-3">
        <Button
          variant="ghost"
          size="sm"
          className="w-fit px-2"
          onClick={() => router.push("/dashboard")}
        >
          <ArrowLeft />
          Back to dashboard
        </Button>
        <div>
          <h1 className="text-2xl font-semibold tracking-tight sm:text-3xl">
            Friends
          </h1>
          <p className="text-sm text-muted-foreground">
            Manage your friends and friend requests.
          </p>
        </div>
      </div>

      <Tabs value={activeTab} onValueChange={(v) => setActiveTab(v as Tab)}>
        <TabsList>
          <TabsTrigger value="friends">
            Friends
            {friends.length > 0 && (
              <Badge variant="secondary">{friends.length}</Badge>
            )}
          </TabsTrigger>
          <TabsTrigger value="requests">
            Requests
            {totalRequests > 0 && (
              <Badge variant="secondary">{totalRequests}</Badge>
            )}
          </TabsTrigger>
          <TabsTrigger value="add">Add friend</TabsTrigger>
        </TabsList>

        {/* Friends */}
        <TabsContent value="friends">
          {friends.length === 0 ? (
            <Empty className="border border-dashed">
              <EmptyHeader>
                <EmptyMedia variant="icon">
                  <Users />
                </EmptyMedia>
                <EmptyTitle>No friends yet</EmptyTitle>
                <EmptyDescription>
                  Add friends using their email address.
                </EmptyDescription>
              </EmptyHeader>
              <EmptyContent>
                <Button onClick={() => setActiveTab("add")}>
                  <UserPlus />
                  Add a friend
                </Button>
              </EmptyContent>
            </Empty>
          ) : (
            <ItemGroup className="gap-3">
              {friends.map((friendship) => (
                <Item key={friendship.id} variant="outline">
                  <ItemMedia>
                    <Avatar className="size-10">
                      <AvatarFallback>
                        {initials(friendship.friend.name)}
                      </AvatarFallback>
                    </Avatar>
                  </ItemMedia>
                  <ItemContent>
                    <ItemTitle>{friendship.friend.name}</ItemTitle>
                    <ItemDescription>{friendship.friend.email}</ItemDescription>
                  </ItemContent>
                  <ItemActions>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => handleRemove(friendship.id)}
                      disabled={processingId === friendship.id}
                    >
                      {processingId === friendship.id ? "Removing…" : "Remove"}
                    </Button>
                  </ItemActions>
                </Item>
              ))}
            </ItemGroup>
          )}
        </TabsContent>

        {/* Requests */}
        <TabsContent value="requests" className="space-y-6">
          <div className="space-y-3">
            <h2 className="text-sm font-medium text-muted-foreground">
              Incoming ({pendingRequests.length})
            </h2>
            {pendingRequests.length === 0 ? (
              <p className="text-sm text-muted-foreground">
                No pending friend requests.
              </p>
            ) : (
              <ItemGroup className="gap-3">
                {pendingRequests.map((request) => (
                  <Item key={request.id} variant="outline">
                    <ItemMedia>
                      <Avatar className="size-10">
                        <AvatarFallback>
                          {initials(request.requester.name)}
                        </AvatarFallback>
                      </Avatar>
                    </ItemMedia>
                    <ItemContent>
                      <ItemTitle>{request.requester.name}</ItemTitle>
                      <ItemDescription>
                        {request.requester.email}
                      </ItemDescription>
                    </ItemContent>
                    <ItemActions>
                      <Button
                        size="sm"
                        onClick={() => handleAccept(request.id)}
                        disabled={processingId === request.id}
                      >
                        Accept
                      </Button>
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => handleReject(request.id)}
                        disabled={processingId === request.id}
                      >
                        Reject
                      </Button>
                    </ItemActions>
                  </Item>
                ))}
              </ItemGroup>
            )}
          </div>

          <div className="space-y-3">
            <h2 className="text-sm font-medium text-muted-foreground">
              Sent ({sentRequests.length})
            </h2>
            {sentRequests.length === 0 ? (
              <p className="text-sm text-muted-foreground">
                No pending sent requests.
              </p>
            ) : (
              <ItemGroup className="gap-3">
                {sentRequests.map((request) => (
                  <Item key={request.id} variant="outline">
                    <ItemMedia>
                      <Avatar className="size-10">
                        <AvatarFallback>
                          {initials(request.recipient.name)}
                        </AvatarFallback>
                      </Avatar>
                    </ItemMedia>
                    <ItemContent>
                      <ItemTitle>{request.recipient.name}</ItemTitle>
                      <ItemDescription>
                        {request.recipient.email}
                      </ItemDescription>
                    </ItemContent>
                    <ItemActions>
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => handleCancel(request.id)}
                        disabled={processingId === request.id}
                      >
                        Cancel
                      </Button>
                    </ItemActions>
                  </Item>
                ))}
              </ItemGroup>
            )}
          </div>
        </TabsContent>

        {/* Add friend */}
        <TabsContent value="add">
          <Card>
            <CardHeader>
              <CardTitle>Add a friend</CardTitle>
              <CardDescription>
                Enter their email address to send a friend request.
              </CardDescription>
            </CardHeader>
            <CardContent>
              <form
                onSubmit={handleAddFriend}
                className="flex flex-col gap-2 sm:flex-row"
              >
                <Input
                  type="email"
                  placeholder="friend@example.com"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className="flex-1"
                />
                <Button type="submit" disabled={addLoading || !email.trim()}>
                  {addLoading ? "Adding…" : "Add friend"}
                </Button>
              </form>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}
