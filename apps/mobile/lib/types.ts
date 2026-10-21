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
  createdAt: string | Date;
  updatedAt: string | Date;
  lender: User;
  borrower: User;
  group: Group | null;
  receipts?: Receipt[];
};

export type Invite = {
  id: number;
  invitedEmail: string;
  invitedBy: string;
  status: string;
  createdAt: string | Date;
  group: Group & {
    members?: {
      id: number;
      userId: string;
      groupId: number;
      createdAt: string | Date;
      user: User;
    }[];
  };
  sender?: User;
};

export type Receipt = {
  id: string;
  rawText: string | null;
  createdAt: string | Date;
  updatedAt: string | Date;
  debts?: Debt[];
};

export type AuthTokens = {
  accessToken: string;
  refreshToken?: string;
};

type Person = { id: string; email: string; name: string | null };

/** GET /api/dashboard (apps/web/src/lib/dashboard-data.ts). Debts are the pending ones. */
export type DashboardData = {
  user: Person;
  debts: (Omit<Debt, 'lender' | 'borrower'> & { lender: Person; borrower: Person })[];
  groups: (Group & { _count: { members: number } })[];
  recurringPayments: { id: number; amount: number; frequency: number; createdAt: string }[];
  alerts: {
    id: number;
    message: string | null;
    deadline: string | null;
    lender: Person;
    debt: { id: number; amount: number; description: string | null } | null;
  }[];
  pendingApprovals: {
    id: number;
    type: string;
    reason: string | null;
    proposedAmount: number | null;
    requester: Person;
    debt: { id: number; amount: number; description: string | null };
  }[];
};

export type DebtTransaction = {
  id: number;
  type: string;
  status: string;
  reason: string | null;
  proposedAmount: number | null;
  createdAt: string;
  requester: Person;
};

/** GET /api/debts/:id */
export type DebtDetail = {
  debt: Omit<Debt, 'lender' | 'borrower'> & { lender: Person; borrower: Person };
  transactions: DebtTransaction[];
  receiptImageUrls: { id: string; url: string }[];
};
