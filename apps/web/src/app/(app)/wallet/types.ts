import type { Wallet, WalletTransaction } from "@prisma/client";

export type { Wallet, WalletTransaction };

export function formatCents(cents: number): string {
  return (cents / 100).toLocaleString("en-US", {
    style: "currency",
    currency: "USD",
  });
}
