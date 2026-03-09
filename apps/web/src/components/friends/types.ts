import type { Friend, User } from "@prisma/client"

export type FriendWithUser = Friend & {
  requester: User
  recipient: User
  friend: User
}

export type PendingRequest = Friend & {
  requester: User
  recipient: User
}

export interface SuggestedUser {
  id: number
  name: string
  handle: string
  email: string
  avatar: string
  initials: string
  mutuals: number
}

export interface FriendsPageProps {
  friends: FriendWithUser[]
  pendingRequests: PendingRequest[]
  sentRequests: PendingRequest[]
  groupCount: number
  suggestions: SuggestedUser[]
}
