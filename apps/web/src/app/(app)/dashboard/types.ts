export type Debt = {
  id: number;
  amount: number;
  description: string | null;
  status: string;
  createdAt: Date | string;
  lender: {
    id: string;
    email: string;
    name: string | null;
  };
  borrower: {
    id: string;
    email: string;
    name: string | null;
  };
  group: {
    id: number;
    name: string;
  } | null;
};

export type DashboardUser = {
  id: string;
  email?: string;
};

export type Group = {
  id: number;
  name: string;
  createdAt: Date | string;
  _count: {
    members: number;
  };
};

export type Tab = {
  id: number;
  amount: number;
  description: string;
  personName: string;
  status: string;
  createdAt: Date | string;
};

export type RecurringPayment = {
  id: number;
  amount: number;
  description: string | null;
  status: string;
  frequency: number;
  createdAt: Date | string;
  lender: {
    id: string;
    email: string;
    name: string;
  };
  borrowers: Array<{
    id: number;
    userId: string;
    splitPercentage: number;
    user: {
      id: string;
      email: string;
      name: string;
    };
  }>;
};

export type OverdueAlert = {
  id: number;
  message: string | null;
  deadline: Date | string | null;
  isActive: boolean;
  createdAt: Date | string;
  lender: {
    id: string;
    email: string;
    name: string | null;
  };
  debt: {
    id: number;
    amount: number;
    description: string | null;
    status: string;
  } | null;
  recurringPayment: {
    id: number;
    amount: number;
    description: string | null;
    status: string;
  } | null;
  group: {
    id: number;
    name: string;
  } | null;
};

export type PendingTransaction = {
  id: number;
  type: string;
  status: string;
  proposedAmount: number | null;
  proposedDescription: string | null;
  reason: string | null;
  createdAt: Date | string;
  requester: {
    id: string;
    email: string;
    name: string | null;
  };
  debt: {
    id: number;
    amount: number;
    description: string | null;
    lender: {
      id: string;
    };
    borrower: {
      id: string;
      email: string;
      name: string | null;
    };
  };
};
