export type Member = {
  id: number;
  user: {
    id: string;
    name: string;
    email: string;
  };
};

export type Invite = {
  id: number;
  invitedEmail: string;
  invitedBy: string;
  status: string;
  sender: {
    id: string;
    email: string;
  };
};

export type Debt = {
  id: number;
  amount: number;
  description: string | null;
  status: string;
  createdAt: Date | string;
  lender: {
    id: string;
    name: string;
    email: string;
  };
  borrower: {
    id: string;
    name: string;
    email: string;
  };
};

export type Group = {
  id: number;
  name: string;
  createdAt: Date | string;
  members: Member[];
  invites: Invite[];
};

export function initials(value: string): string {
  const parts = value.split(/[\s._-]+/).filter(Boolean);
  const letters = (parts[0]?.[0] ?? "") + (parts[1]?.[0] ?? "");
  return (letters || value.slice(0, 2)).toUpperCase();
}
