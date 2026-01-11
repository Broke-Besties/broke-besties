import { Friend } from "@prisma/client";

export class FriendPolicy {
  /**
   * Check if user can accept or reject a friend request (must be recipient)
   */
  static canAcceptOrReject(
    userId: string,
    friend: Pick<Friend, "recipientId" | "status">
  ): boolean {
    return friend.recipientId === userId && friend.status === "pending";
  }

  /**
   * Check if user can cancel a friend request (must be requester and pending)
   */
  static canCancel(
    userId: string,
    friend: Pick<Friend, "requesterId" | "status">
  ): boolean {
    return friend.requesterId === userId && friend.status === "pending";
  }

  /**
   * Check if user can remove a friendship (either party can remove accepted friendship)
   */
  static canRemove(
    userId: string,
    friend: Pick<Friend, "requesterId" | "recipientId" | "status">
  ): boolean {
    if (friend.status !== "accepted") return false;
    return friend.requesterId === userId || friend.recipientId === userId;
  }

  /**
   * Check if user is involved in this friendship
   */
  static isInvolved(
    userId: string,
    friend: Pick<Friend, "requesterId" | "recipientId">
  ): boolean {
    return friend.requesterId === userId || friend.recipientId === userId;
  }
}
