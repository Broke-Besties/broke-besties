export type User = {
  id: string;
  email: string;
  name?: string | null;
  createdAt: string | Date;
};

export type Group = {
  id: number;
  name: string;
  createdAt: string | Date;
  _count?: {
    members: number;
  };
};

export type Debt = {
  id: number;
  amount: number;
  description: string | null;
  status: 'pending' | 'paid' | 'not_paying';
  createdAt: string | Date;
  lender: User;
  borrower: User;
  group: Group | null;
};

export type Invite = {
  id: number;
  email: string;
  createdAt: string | Date;
  group: Group & {
    _count: {
      members: number;
    };
    creator: User;
  };
};

export type Member = {
  userId: string;
  groupId: number;
  role: string;
  joinedAt: string | Date;
  user: User;
};

export type Receipt = {
  id: number;
  groupId: number;
  userId: string;
  fileKey: string;
  fileName: string;
  fileUrl: string;
  rawText: string | null;
  createdAt: string | Date;
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
