import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { getUser } from "@/lib/supabase";
import { debtTransactionService } from "@/services/debt-transaction.service";
import { Button } from "@/components/ui/button";
import { PageHeader } from "@/components/page-header";
import { PendingRequestCard } from "../../pending-request-card";
import { displayName, transactionTypeLabel } from "../../types";

export default async function RequestDetailPage({
  params,
}: {
  params: Promise<{ id: string; requestId: string }>;
}) {
  const user = await getUser();
  if (!user) redirect("/login");

  const { id, requestId } = await params;
  // Seeded local records use negative IDs; real IDs are positive integers.
  if (
    ![id, requestId].every(
      (value) =>
        /^-?\d+$/.test(value) &&
        Number.isSafeInteger(Number(value)) &&
        Math.abs(Number(value)) <= 2147483647,
    )
  ) {
    notFound();
  }

  let transaction;
  try {
    transaction = await debtTransactionService.getTransactionById(
      Number(requestId),
      user.id,
    );
  } catch {
    notFound();
  }
  if (transaction.debtId !== Number(id)) notFound();

  const { debt } = transaction;
  const otherPerson = debt.lenderId === user.id ? debt.borrower : debt.lender;

  return (
    <div className="flex max-w-3xl flex-col gap-6">
      <PageHeader
        title={transactionTypeLabel(transaction.type)}
        description={`${debt.description || "Debt"} with ${displayName(otherPerson)}${debt.group ? ` · ${debt.group.name}` : ""}`}
        breadcrumbs={[
          { label: "Debts", href: "/debts" },
          { label: "Requests", href: "/debts/requests" },
          { label: `Request #${transaction.id}` },
        ]}
        actions={
          <Button variant="outline" asChild>
            <Link href={`/debts/${debt.id}`}>View debt</Link>
          </Button>
        }
      />
      <PendingRequestCard
        transaction={transaction}
        debt={debt}
        currentUserId={user.id}
      />
    </div>
  );
}
