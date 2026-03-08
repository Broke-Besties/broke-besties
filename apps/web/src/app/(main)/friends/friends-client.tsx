"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Users, UserPlus, UserX } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import {
  Empty,
  EmptyContent,
  EmptyDescription,
  EmptyHeader,
  EmptyMedia,
  EmptyTitle,
} from "@/components/ui/empty";
import { Separator } from "@/components/ui/separator";

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

function getInitials(name: string): string {
  return name
    .split(" ")
    .map((n) => n[0])
    .join("")
    .toUpperCase()
    .slice(0, 2);
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
  const [processingId, setProcessingId] = useState<number | null>(null);
  const [email, setEmail] = useState("");
  const [addLoading, setAddLoading] = useState(false);
  const [activeTab, setActiveTab] = useState("friends");
  const router = useRouter();

  const handleAccept = async (requestId: number) => {
    setProcessingId(requestId);

    try {
      const result = await acceptFriendRequest(requestId);

      if (!result.success) {
        toast.error(result.error || "Failed to accept request");
        setProcessingId(null);
        return;
      }

      setPendingRequests((prev) => prev.filter((r) => r.id !== requestId));
      if (result.friend) {
        setFriends((prev) => [
          ...prev,
          { ...result.friend, friend: result.friend.requester },
        ]);
      }
      toast.success("Friend request accepted!");
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
        setProcessingId(null);
        return;
      }

      setPendingRequests((prev) => prev.filter((r) => r.id !== requestId));
      toast.success("Request rejected");
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
        setProcessingId(null);
        return;
      }

      setSentRequests((prev) => prev.filter((r) => r.id !== requestId));
      toast.success("Request cancelled");
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
        setProcessingId(null);
        return;
      }

      setFriends((prev) => prev.filter((f) => f.id !== friendshipId));
      toast.success("Friend removed");
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
        setAddLoading(false);
        return;
      }

      if (result.autoAccepted && result.friend) {
        setFriends((prev) => [
          ...prev,
          { ...result.friend, friend: result.friend.requester },
        ]);
        toast.success("You are now friends!");
      } else if (result.friend) {
        setSentRequests((prev) => [result.friend, ...prev]);
        toast.success("Friend request sent!");
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
    <div className="space-y-8">
      <div className="flex flex-col gap-3">
        <Button
          variant="ghost"
          className="w-fit px-0"
          onClick={() => router.push("/dashboard")}
        >
          &larr; Back to dashboard
        </Button>
        <div className="space-y-1">
          <h1 className="text-3xl font-semibold tracking-tight">Friends</h1>
          <p className="text-sm text-muted-foreground">
            Manage your friends and friend requests.
          </p>
        </div>
      </div>

      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <TabsList>
          <TabsTrigger value="friends">
            Friends
            {friends.length > 0 && (
              <Badge variant="secondary" className="ml-2">
                {friends.length}
              </Badge>
            )}
          </TabsTrigger>
          <TabsTrigger value="requests">
            Requests
            {totalRequests > 0 && (
              <Badge variant="secondary" className="ml-2">
                {totalRequests}
              </Badge>
            )}
          </TabsTrigger>
          <TabsTrigger value="add">Add Friend</TabsTrigger>
        </TabsList>

        {/* Friends Tab */}
        <TabsContent value="friends">
          {friends.length === 0 ? (
            <Empty>
              <EmptyHeader>
                <EmptyMedia variant="icon">
                  <Users />
                </EmptyMedia>
                <EmptyTitle>No friends yet</EmptyTitle>
                <EmptyDescription>
                  Start by adding friends using their email address.
                </EmptyDescription>
              </EmptyHeader>
              <EmptyContent>
                <Button
                  onClick={() => setActiveTab("add")}
                >
                  <UserPlus className="mr-2 h-4 w-4" />
                  Add a friend
                </Button>
              </EmptyContent>
            </Empty>
          ) : (
            <div className="grid gap-4">
              {friends.map((friendship) => (
                <Card key={friendship.id}>
                  <CardHeader className="flex-row items-center justify-between space-y-0">
                    <div className="flex items-center gap-3">
                      <Avatar>
                        <AvatarFallback>
                          {getInitials(friendship.friend.name)}
                        </AvatarFallback>
                      </Avatar>
                      <div className="space-y-1">
                        <CardTitle className="text-lg">
                          {friendship.friend.name}
                        </CardTitle>
                        <CardDescription>
                          {friendship.friend.email}
                        </CardDescription>
                      </div>
                    </div>
                    <AlertDialog>
                      <AlertDialogTrigger asChild>
                        <Button
                          variant="outline"
                          size="sm"
                          disabled={processingId === friendship.id}
                        >
                          {processingId === friendship.id
                            ? "Removing..."
                            : "Remove"}
                        </Button>
                      </AlertDialogTrigger>
                      <AlertDialogContent>
                        <AlertDialogHeader>
                          <AlertDialogTitle>Remove friend?</AlertDialogTitle>
                          <AlertDialogDescription>
                            Are you sure you want to remove{" "}
                            <strong>{friendship.friend.name}</strong> from your
                            friends? You can always add them back later.
                          </AlertDialogDescription>
                        </AlertDialogHeader>
                        <AlertDialogFooter>
                          <AlertDialogCancel>Cancel</AlertDialogCancel>
                          <AlertDialogAction
                            onClick={() => handleRemove(friendship.id)}
                          >
                            Remove
                          </AlertDialogAction>
                        </AlertDialogFooter>
                      </AlertDialogContent>
                    </AlertDialog>
                  </CardHeader>
                </Card>
              ))}
            </div>
          )}
        </TabsContent>

        {/* Requests Tab */}
        <TabsContent value="requests">
          <div className="space-y-6">
            {/* Incoming Requests */}
            <div className="space-y-4">
              <h2 className="text-lg font-medium">
                Incoming Requests ({pendingRequests.length})
              </h2>
              {pendingRequests.length === 0 ? (
                <p className="text-sm text-muted-foreground">
                  No pending friend requests.
                </p>
              ) : (
                <div className="grid gap-4">
                  {pendingRequests.map((request) => (
                    <Card key={request.id}>
                      <CardHeader className="flex-row items-center justify-between space-y-0">
                        <div className="flex items-center gap-3">
                          <Avatar>
                            <AvatarFallback>
                              {getInitials(request.requester.name)}
                            </AvatarFallback>
                          </Avatar>
                          <div className="space-y-1">
                            <CardTitle className="text-lg">
                              {request.requester.name}
                            </CardTitle>
                            <CardDescription>
                              {request.requester.email}
                            </CardDescription>
                          </div>
                        </div>
                        <div className="flex gap-2">
                          <Button
                            size="sm"
                            onClick={() => handleAccept(request.id)}
                            disabled={processingId === request.id}
                          >
                            {processingId === request.id ? "..." : "Accept"}
                          </Button>
                          <AlertDialog>
                            <AlertDialogTrigger asChild>
                              <Button
                                variant="outline"
                                size="sm"
                                disabled={processingId === request.id}
                              >
                                Reject
                              </Button>
                            </AlertDialogTrigger>
                            <AlertDialogContent>
                              <AlertDialogHeader>
                                <AlertDialogTitle>
                                  Reject request?
                                </AlertDialogTitle>
                                <AlertDialogDescription>
                                  Are you sure you want to reject the friend
                                  request from{" "}
                                  <strong>{request.requester.name}</strong>?
                                </AlertDialogDescription>
                              </AlertDialogHeader>
                              <AlertDialogFooter>
                                <AlertDialogCancel>Cancel</AlertDialogCancel>
                                <AlertDialogAction
                                  onClick={() => handleReject(request.id)}
                                >
                                  Reject
                                </AlertDialogAction>
                              </AlertDialogFooter>
                            </AlertDialogContent>
                          </AlertDialog>
                        </div>
                      </CardHeader>
                    </Card>
                  ))}
                </div>
              )}
            </div>

            <Separator />

            {/* Sent Requests */}
            <div className="space-y-4">
              <h2 className="text-lg font-medium">
                Sent Requests ({sentRequests.length})
              </h2>
              {sentRequests.length === 0 ? (
                <p className="text-sm text-muted-foreground">
                  No pending sent requests.
                </p>
              ) : (
                <div className="grid gap-4">
                  {sentRequests.map((request) => (
                    <Card key={request.id}>
                      <CardHeader className="flex-row items-center justify-between space-y-0">
                        <div className="flex items-center gap-3">
                          <Avatar>
                            <AvatarFallback>
                              {getInitials(request.recipient.name)}
                            </AvatarFallback>
                          </Avatar>
                          <div className="space-y-1">
                            <CardTitle className="text-lg">
                              {request.recipient.name}
                            </CardTitle>
                            <CardDescription>
                              {request.recipient.email}
                            </CardDescription>
                          </div>
                        </div>
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => handleCancel(request.id)}
                          disabled={processingId === request.id}
                        >
                          {processingId === request.id ? "..." : "Cancel"}
                        </Button>
                      </CardHeader>
                    </Card>
                  ))}
                </div>
              )}
            </div>
          </div>
        </TabsContent>

        {/* Add Friend Tab */}
        <TabsContent value="add">
          <Card>
            <CardHeader>
              <CardTitle>Add a Friend</CardTitle>
              <CardDescription>
                Enter their email address to send a friend request.
              </CardDescription>
            </CardHeader>
            <CardContent>
              <form onSubmit={handleAddFriend} className="flex gap-2">
                <Input
                  type="email"
                  placeholder="friend@example.com"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className="flex-1"
                />
                <Button type="submit" disabled={addLoading || !email.trim()}>
                  <UserPlus className="mr-2 h-4 w-4" />
                  {addLoading ? "Adding..." : "Add Friend"}
                </Button>
              </form>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}
