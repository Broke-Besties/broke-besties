import { prisma } from "@/lib/prisma";
import { FriendPolicy } from "@/policies/friend.policy";

export class FriendService {
  /**
   * Send a friend request (or auto-accept if reverse request exists)
   */
  async sendFriendRequest(requesterId: string, recipientId: string) {
    if (!recipientId) {
      throw new Error("Recipient ID is required");
    }

    if (requesterId === recipientId) {
      throw new Error("You cannot send a friend request to yourself");
    }

    // Check if recipient exists
    const recipient = await prisma.user.findUnique({
      where: { id: recipientId },
    });

    if (!recipient) {
      throw new Error("User not found");
    }

    // Check if friendship already exists in either direction
    const existingFriendship = await prisma.friend.findFirst({
      where: {
        OR: [
          { requesterId, recipientId },
          { requesterId: recipientId, recipientId: requesterId },
        ],
      },
    });

    if (existingFriendship) {
      // If there's a pending request from the other user, accept it
      if (
        existingFriendship.requesterId === recipientId &&
        existingFriendship.status === "pending"
      ) {
        const updated = await prisma.friend.update({
          where: { id: existingFriendship.id },
          data: { status: "accepted" },
          include: {
            requester: true,
            recipient: true,
          },
        });
        return { friend: updated, autoAccepted: true };
      }

      // Already friends or pending request exists
      if (existingFriendship.status === "accepted") {
        throw new Error("You are already friends with this user");
      }
      throw new Error("Friend request already exists");
    }

    // Create new friend request
    const friend = await prisma.friend.create({
      data: {
        requesterId,
        recipientId,
      },
      include: {
        requester: true,
        recipient: true,
      },
    });

    return { friend, autoAccepted: false };
  }

  /**
   * Accept a friend request (recipient only)
   */
  async acceptFriendRequest(friendId: number, userId: string) {
    const friend = await prisma.friend.findUnique({
      where: { id: friendId },
    });

    if (!friend) {
      throw new Error("Friend request not found");
    }

    if (!FriendPolicy.canAcceptOrReject(userId, friend)) {
      throw new Error("You cannot accept this friend request");
    }

    const updated = await prisma.friend.update({
      where: { id: friendId },
      data: { status: "accepted" },
      include: {
        requester: true,
        recipient: true,
      },
    });

    return updated;
  }

  /**
   * Reject a friend request (recipient only)
   */
  async rejectFriendRequest(friendId: number, userId: string) {
    const friend = await prisma.friend.findUnique({
      where: { id: friendId },
    });

    if (!friend) {
      throw new Error("Friend request not found");
    }

    if (!FriendPolicy.canAcceptOrReject(userId, friend)) {
      throw new Error("You cannot reject this friend request");
    }

    await prisma.friend.delete({
      where: { id: friendId },
    });

    return { success: true };
  }

  /**
   * Cancel a sent friend request (requester only)
   */
  async cancelFriendRequest(friendId: number, userId: string) {
    const friend = await prisma.friend.findUnique({
      where: { id: friendId },
    });

    if (!friend) {
      throw new Error("Friend request not found");
    }

    if (!FriendPolicy.canCancel(userId, friend)) {
      throw new Error("You cannot cancel this friend request");
    }

    await prisma.friend.delete({
      where: { id: friendId },
    });

    return { success: true };
  }

  /**
   * Remove a friendship (either party can do this)
   */
  async removeFriend(friendId: number, userId: string) {
    const friend = await prisma.friend.findUnique({
      where: { id: friendId },
    });

    if (!friend) {
      throw new Error("Friendship not found");
    }

    if (!FriendPolicy.canRemove(userId, friend)) {
      throw new Error("You cannot remove this friendship");
    }

    await prisma.friend.delete({
      where: { id: friendId },
    });

    return { success: true };
  }

  /**
   * Get all accepted friends for a user
   */
  async getFriends(userId: string) {
    const friendships = await prisma.friend.findMany({
      where: {
        status: "accepted",
        OR: [{ requesterId: userId }, { recipientId: userId }],
      },
      include: {
        requester: true,
        recipient: true,
      },
      orderBy: {
        updatedAt: "desc",
      },
    });

    // Map to friend user objects
    return friendships.map((f) => ({
      ...f,
      friend: f.requesterId === userId ? f.recipient : f.requester,
    }));
  }

  /**
   * Get pending incoming friend requests
   */
  async getPendingRequests(userId: string) {
    const requests = await prisma.friend.findMany({
      where: {
        recipientId: userId,
        status: "pending",
      },
      include: {
        requester: true,
        recipient: true,
      },
      orderBy: {
        createdAt: "desc",
      },
    });

    return requests;
  }

  /**
   * Get sent pending friend requests
   */
  async getSentRequests(userId: string) {
    const requests = await prisma.friend.findMany({
      where: {
        requesterId: userId,
        status: "pending",
      },
      include: {
        requester: true,
        recipient: true,
      },
      orderBy: {
        createdAt: "desc",
      },
    });

    return requests;
  }

  /**
   * Check if two users are friends
   */
  async areFriends(userId: string, otherUserId: string): Promise<boolean> {
    const friendship = await prisma.friend.findFirst({
      where: {
        status: "accepted",
        OR: [
          { requesterId: userId, recipientId: otherUserId },
          { requesterId: otherUserId, recipientId: userId },
        ],
      },
    });

    return !!friendship;
  }

  /**
   * Get friendship between two users (if any)
   */
  async getFriendship(userId: string, otherUserId: string) {
    const friendship = await prisma.friend.findFirst({
      where: {
        OR: [
          { requesterId: userId, recipientId: otherUserId },
          { requesterId: otherUserId, recipientId: userId },
        ],
      },
      include: {
        requester: true,
        recipient: true,
      },
    });

    return friendship;
  }

  /**
   * Get most recent accepted friends (ordered by updatedAt desc)
   */
  async getRecentFriends(userId: string, limit: number = 5) {
    const friendships = await prisma.friend.findMany({
      where: {
        status: "accepted",
        OR: [{ requesterId: userId }, { recipientId: userId }],
      },
      include: {
        requester: true,
        recipient: true,
      },
      orderBy: {
        updatedAt: "desc",
      },
      take: limit,
    });

    // Map to friend user objects
    return friendships.map((f) => ({
      ...f,
      friend: f.requesterId === userId ? f.recipient : f.requester,
    }));
  }

  /**
   * Search accepted friends by name or email
   */
  async searchFriends(userId: string, query: string) {
    if (!query || query.trim().length === 0) {
      return [];
    }

    const searchQuery = query.trim().toLowerCase();

    const friendships = await prisma.friend.findMany({
      where: {
        status: "accepted",
        OR: [{ requesterId: userId }, { recipientId: userId }],
      },
      include: {
        requester: true,
        recipient: true,
      },
      orderBy: {
        updatedAt: "desc",
      },
    });

    // Filter by name or email match and map to friend user objects
    return friendships
      .map((f) => ({
        ...f,
        friend: f.requesterId === userId ? f.recipient : f.requester,
      }))
      .filter(
        (f) =>
          f.friend.name.toLowerCase().includes(searchQuery) ||
          f.friend.email.toLowerCase().includes(searchQuery)
      );
  }
}

export const friendService = new FriendService();
