export type User = {
  id: string;
  name: string;
  email: string;
};

export type Friend = {
  id: number;
  requesterId: string;
  recipientId: string;
  status: string;
  createdAt: Date | string;
  requester: User;
  recipient: User;
  friend: User;
};

export type FriendRequest = {
  id: number;
  requesterId: string;
  recipientId: string;
  status: string;
  createdAt: Date | string;
  requester: User;
  recipient: User;
};

export type PendingAction = {
  id: number;
  action: "accept" | "reject" | "cancel" | "remove";
};
