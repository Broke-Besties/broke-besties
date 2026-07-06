export type TabDirection = "lending" | "borrowing";

export type Tab = {
  id: number;
  amount: number;
  description: string;
  personName: string;
  status: string;
  createdAt: Date | string;
};
