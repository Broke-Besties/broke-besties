export type User = {
  id: string;
  email: string;
  name: string;
  createdAt: string | Date;
  updatedAt: string | Date;
};

export type Member = {
  userId: string;
  groupId: number;
  role: string;
  joinedAt: string | Date;
  user: User;
};

export type Group = {
  id: number;
  name: string;
  createdAt: string | Date;
  updatedAt: string | Date;
  _count?: {
    members: number;
  };
  members?: Member[];
};

export type Debt = {
  id: number;
  amount: number;
  description: string | null;
  status: 'pending' | 'paid' | 'not_paying';
  lenderId: string;
  borrowerId: string;
  groupId: number;
  receiptId: string | null;
  createdAt: string | Date;
  updatedAt: string | Date;
  lender: User;
  borrower: User;
  group: Group | null;
};

export type Invite = {
  id: number;
  invitedEmail: string;
  invitedBy: string;
  status: string;
  createdAt: string | Date;
  group: Group & {
    members?: Array<{
      id: number;
      userId: string;
      groupId: number;
      createdAt: string | Date;
      user: User;
    }>;
  };
  sender?: User;
};

export type Receipt = {
  id: string;
  groupId: number;
  rawText: string | null;
  createdAt: string | Date;
  updatedAt: string | Date;
};

export type ApiResponse<T> = {
  success: boolean;
  data?: T;
  error?: string;
};

export type AuthTokens = {
  accessToken: string;
  refreshToken?: string;
};
