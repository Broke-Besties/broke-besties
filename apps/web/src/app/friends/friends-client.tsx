"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

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
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const [processingId, setProcessingId] = useState<number | null>(null);
  const [email, setEmail] = useState("");
  const [addLoading, setAddLoading] = useState(false);
  const router = useRouter();

  const handleAccept = async (requestId: number) => {
    setProcessingId(requestId);
    setError("");

    try {
      const result = await acceptFriendRequest(requestId);

      if (!result.success) {
        setError(result.error || "Failed to accept request");
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
      setSuccess("Friend request accepted!");
      setTimeout(() => setSuccess(""), 3000);
    } catch {
      setError("An error occurred");
    } finally {
      setProcessingId(null);
    }
  };

  const handleReject = async (requestId: number) => {
    setProcessingId(requestId);
    setError("");

    try {
      const result = await rejectFriendRequest(requestId);

      if (!result.success) {
        setError(result.error || "Failed to reject request");
        setProcessingId(null);
        return;
      }

      setPendingRequests((prev) => prev.filter((r) => r.id !== requestId));
    } catch {
      setError("An error occurred");
    } finally {
      setProcessingId(null);
    }
  };

  const handleCancel = async (requestId: number) => {
    setProcessingId(requestId);
    setError("");

    try {
      const result = await cancelFriendRequest(requestId);

      if (!result.success) {
        setError(result.error || "Failed to cancel request");
        setProcessingId(null);
        return;
      }

      setSentRequests((prev) => prev.filter((r) => r.id !== requestId));
    } catch {
      setError("An error occurred");
    } finally {
      setProcessingId(null);
    }
  };

  const handleRemove = async (friendshipId: number) => {
    setProcessingId(friendshipId);
    setError("");

    try {
      const result = await removeFriend(friendshipId);

      if (!result.success) {
        setError(result.error || "Failed to remove friend");
        setProcessingId(null);
        return;
      }

      setFriends((prev) => prev.filter((f) => f.id !== friendshipId));
    } catch {
      setError("An error occurred");
    } finally {
      setProcessingId(null);
    }
  };

  const handleAddFriend = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email.trim()) return;

    setAddLoading(true);
    setError("");

    try {
      const result = await sendFriendRequestByEmail(email.trim());

      if (!result.success) {
        setError(result.error || "Failed to add friend");
        setAddLoading(false);
        return;
      }

      if (result.autoAccepted && result.friend) {
        setFriends((prev) => [
          ...prev,
          { ...result.friend, friend: result.friend.requester },
        ]);
        setSuccess("You are now friends!");
      } else if (result.friend) {
        setSentRequests((prev) => [result.friend, ...prev]);
        setSuccess("Friend request sent!");
      }

      setEmail("");
      setTimeout(() => setSuccess(""), 3000);
    } catch {
      setError("An error occurred");
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

      {/* Tabs */}
      <div className="flex gap-2 border-b">
        <button
          onClick={() => setActiveTab("friends")}
          className={`px-4 py-2 text-sm font-medium border-b-2 -mb-px transition-colors ${
            activeTab === "friends"
              ? "border-primary text-primary"
              : "border-transparent text-muted-foreground hover:text-foreground"
          }`}
        >
          Friends
          {friends.length > 0 && (
            <Badge variant="secondary" className="ml-2">
              {friends.length}
            </Badge>
          )}
        </button>
        <button
          onClick={() => setActiveTab("requests")}
          className={`px-4 py-2 text-sm font-medium border-b-2 -mb-px transition-colors ${
            activeTab === "requests"
              ? "border-primary text-primary"
              : "border-transparent text-muted-foreground hover:text-foreground"
          }`}
        >
          Requests
          {totalRequests > 0 && (
            <Badge variant="secondary" className="ml-2">
              {totalRequests}
            </Badge>
          )}
        </button>
        <button
          onClick={() => setActiveTab("add")}
          className={`px-4 py-2 text-sm font-medium border-b-2 -mb-px transition-colors ${
            activeTab === "add"
              ? "border-primary text-primary"
              : "border-transparent text-muted-foreground hover:text-foreground"
          }`}
        >
          Add Friend
        </button>
      </div>

      {error && (
        <div className="rounded-md border border-destructive/30 bg-destructive/10 px-3 py-2 text-sm text-destructive">
          {error}
        </div>
      )}

      {success && (
        <div className="rounded-md border border-green-500/30 bg-green-500/10 px-3 py-2 text-sm text-green-600">
          {success}
        </div>
      )}

      {/* Friends Tab */}
      {activeTab === "friends" && (
        <>
          {friends.length === 0 ? (
            <Card className="border-dashed">
              <CardHeader>
                <CardTitle>No friends yet</CardTitle>
                <CardDescription>
                  Start by adding friends using their email address.
                </CardDescription>
              </CardHeader>
              <CardContent>
                <Button onClick={() => setActiveTab("add")}>Add a friend</Button>
              </CardContent>
            </Card>
          ) : (
            <div className="grid gap-4">
              {friends.map((friendship) => (
                <Card key={friendship.id}>
                  <CardHeader className="flex-row items-center justify-between space-y-0">
                    <div className="space-y-1">
                      <CardTitle className="text-lg">
                        {friendship.friend.name}
                      </CardTitle>
                      <CardDescription>{friendship.friend.email}</CardDescription>
                    </div>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => handleRemove(friendship.id)}
                      disabled={processingId === friendship.id}
                    >
                      {processingId === friendship.id ? "Removing..." : "Remove"}
                    </Button>
                  </CardHeader>
                </Card>
              ))}
            </div>
          )}
        </>
      )}

      {/* Requests Tab */}
      {activeTab === "requests" && (
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
                      <div className="space-y-1">
                        <CardTitle className="text-lg">
                          {request.requester.name}
                        </CardTitle>
                        <CardDescription>
                          {request.requester.email}
                        </CardDescription>
                      </div>
                      <div className="flex gap-2">
                        <Button
                          size="sm"
                          onClick={() => handleAccept(request.id)}
                          disabled={processingId === request.id}
                        >
                          {processingId === request.id ? "..." : "Accept"}
                        </Button>
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => handleReject(request.id)}
                          disabled={processingId === request.id}
                        >
                          Reject
                        </Button>
                      </div>
                    </CardHeader>
                  </Card>
                ))}
              </div>
            )}
          </div>

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
                      <div className="space-y-1">
                        <CardTitle className="text-lg">
                          {request.recipient.name}
                        </CardTitle>
                        <CardDescription>
                          {request.recipient.email}
                        </CardDescription>
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
      )}

      {/* Add Friend Tab */}
      {activeTab === "add" && (
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
                {addLoading ? "Adding..." : "Add Friend"}
              </Button>
            </form>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
