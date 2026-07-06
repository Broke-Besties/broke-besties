export type DebtParty = {
  id: string;
  email: string;
  name: string | null;
};

export type ReceiptRecord = {
  id: string;
  rawText: string | null;
  createdAt: Date | string;
};

export type DebtAlert = {
  id: number;
  message: string | null;
  deadline: Date | string | null;
  isActive: boolean;
  reminderFrequencyDays: number | null;
};

export type DebtDetail = {
  id: number;
  amount: number;
  description: string | null;
  status: string;
  createdAt: Date | string;
  lender: DebtParty;
  borrower: DebtParty;
  group: {
    id: number;
    name: string;
  } | null;
  receipts?: ReceiptRecord[];
  alert?: DebtAlert | null;
};

export type DebtTransactionRecord = {
  id: number;
  type: string;
  status: string;
  lenderApproved: boolean;
  borrowerApproved: boolean;
  proposedAmount: number | null;
  proposedDescription: string | null;
  reason: string | null;
  createdAt: Date | string;
  requester: {
    id: string;
    email: string;
    name: string | null;
  };
};

export function initials(value: string): string {
  const parts = value.split(/[\s._@-]+/).filter(Boolean);
  const letters = (parts[0]?.[0] ?? "") + (parts[1]?.[0] ?? "");
  return (letters || value.slice(0, 2)).toUpperCase();
}

export const displayName = (p: { name: string | null; email: string }) =>
  p.name || p.email;

export function transactionTypeLabel(type: string): string {
  switch (type) {
    case "confirm_paid":
      return "Payment confirmation";
    case "modify":
      return "Modification request";
    case "drop":
      return "Deletion request";
    default:
      return type;
  }
}
