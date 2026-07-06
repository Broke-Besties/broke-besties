"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import {
  Calendar,
  CheckCircle2,
  ChevronDown,
  Pencil,
  Trash2,
  Users,
} from "lucide-react";
import { Avatar, AvatarFallback, AvatarGroup } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Item,
  ItemContent,
  ItemGroup,
  ItemTitle,
} from "@/components/ui/item";
import { PageHeader } from "@/components/page-header";
import { StatusBadge } from "@/components/status-badge";
import { ConfirmPaidModal } from "../confirm-paid-modal";
import { ModifyDebtModal } from "../modify-debt-modal";
import { DeleteDebtModal } from "../delete-debt-modal";
import { ActivityCard } from "./activity-card";
import { PendingRequestCard } from "./pending-request-card";
import { ReceiptsCard } from "./receipts-card";
import { ReminderCard } from "./reminder-card";
import {
  displayName,
  initials,
  type DebtDetail,
  type DebtTransactionRecord,
} from "./types";

type ModalType = "paid" | "modify" | "delete" | null;

type DebtDetailClientProps = {
  debt: DebtDetail;
  transactions: DebtTransactionRecord[];
  currentUserId: string;
  receiptImageUrls: { id: string; url: string }[];
};

export default function DebtDetailClient({
  debt,
  transactions,
  currentUserId,
  receiptImageUrls,
}: DebtDetailClientProps) {
  const router = useRouter();
  const [activeModal, setActiveModal] = useState<ModalType>(null);

  const isLender = debt.lender.id === currentUserId;
  const isBorrower = debt.borrower.id === currentUserId;
  const pendingTransaction = transactions.find((t) => t.status === "pending");

  const lenderName = displayName(debt.lender);
  const borrowerName = displayName(debt.borrower);
  const otherName = isLender ? borrowerName : lenderName;

  const amountLabel = `$${debt.amount.toFixed(2)}`;
  const headline = isLender
    ? `${borrowerName} owes you`
    : isBorrower
      ? `You owe ${lenderName}`
      : `${borrowerName} owes ${lenderName}`;
  const title = `${headline} ${amountLabel}`;

  const createdLabel = new Date(debt.createdAt).toLocaleDateString();
  const description = debt.description
    ? `${debt.description} · Created ${createdLabel}`
    : `Created ${createdLabel}`;

  const canAct = debt.status === "pending" && !pendingTransaction;

  const handleModalClose = () => setActiveModal(null);
  const handleSuccess = () => router.refresh();

  return (
    <div className="space-y-6">
      <PageHeader
        breadcrumbs={[{ label: "Debts", href: "/debts" }, { label: otherName }]}
        title={title}
        description={description}
        actions={
          canAct ? (
            <>
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button variant="outline">
                    Request change
                    <ChevronDown />
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end">
                  <DropdownMenuItem onClick={() => setActiveModal("modify")}>
                    <Pencil />
                    Modify
                  </DropdownMenuItem>
                  <DropdownMenuItem
                    variant="destructive"
                    onClick={() => setActiveModal("delete")}
                  >
                    <Trash2 />
                    Delete
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
              <Button onClick={() => setActiveModal("paid")}>
                <CheckCircle2 />
                Mark as paid
              </Button>
            </>
          ) : pendingTransaction ? (
            <p className="text-sm text-muted-foreground">
              Actions are unavailable while a request is pending.
            </p>
          ) : undefined
        }
      />

      <div className="grid gap-6 lg:grid-cols-3">
        {/* Main column */}
        <div className="space-y-6 lg:col-span-2">
          {pendingTransaction && (
            <PendingRequestCard
              transaction={pendingTransaction}
              debt={debt}
              currentUserId={currentUserId}
            />
          )}

          {/* Hero */}
          <Card>
            <CardContent className="flex flex-col items-center gap-4 py-8 text-center">
              <AvatarGroup>
                <Avatar size="lg">
                  <AvatarFallback>{initials(borrowerName)}</AvatarFallback>
                </Avatar>
                <Avatar size="lg">
                  <AvatarFallback>{initials(lenderName)}</AvatarFallback>
                </Avatar>
              </AvatarGroup>

              <div className="space-y-1">
                <p className="text-sm text-muted-foreground">{headline}</p>
                <div className="text-5xl font-semibold tracking-tight tabular-nums">
                  {amountLabel}
                </div>
              </div>

              <StatusBadge status={debt.status} />
            </CardContent>
          </Card>

          <ActivityCard transactions={transactions} />
        </div>

        {/* Side rail */}
        <div className="space-y-6">
          {/* Details */}
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Details</CardTitle>
            </CardHeader>
            <CardContent>
              <ItemGroup className="gap-0 rounded-lg border">
                <Item size="sm">
                  <ItemContent>
                    <ItemTitle className="font-normal text-muted-foreground">
                      Lender
                    </ItemTitle>
                  </ItemContent>
                  <span className="text-sm font-medium">{lenderName}</span>
                </Item>
                <Item size="sm">
                  <ItemContent>
                    <ItemTitle className="font-normal text-muted-foreground">
                      Borrower
                    </ItemTitle>
                  </ItemContent>
                  <span className="text-sm font-medium">{borrowerName}</span>
                </Item>
                <Item size="sm">
                  <ItemContent>
                    <ItemTitle className="flex items-center gap-2 font-normal text-muted-foreground">
                      <Users className="size-4" />
                      Group
                    </ItemTitle>
                  </ItemContent>
                  <span className="text-sm font-medium">
                    {debt.group?.name ?? "No group"}
                  </span>
                </Item>
                <Item size="sm">
                  <ItemContent>
                    <ItemTitle className="flex items-center gap-2 font-normal text-muted-foreground">
                      <Calendar className="size-4" />
                      Created
                    </ItemTitle>
                  </ItemContent>
                  <span className="text-sm font-medium">{createdLabel}</span>
                </Item>
              </ItemGroup>
            </CardContent>
          </Card>

          <ReminderCard
            debtId={debt.id}
            alert={debt.alert ?? null}
            isLender={isLender}
          />

          <ReceiptsCard
            debtId={debt.id}
            receipts={debt.receipts ?? []}
            receiptImageUrls={receiptImageUrls}
          />
        </div>
      </div>

      {/* Shared modals (same flows as the debts list) */}
      <ConfirmPaidModal
        isOpen={activeModal === "paid"}
        onClose={handleModalClose}
        onSuccess={handleSuccess}
        debt={debt}
        isLender={isLender}
      />

      <ModifyDebtModal
        isOpen={activeModal === "modify"}
        onClose={handleModalClose}
        onSuccess={handleSuccess}
        debt={debt}
        isLender={isLender}
      />

      <DeleteDebtModal
        isOpen={activeModal === "delete"}
        onClose={handleModalClose}
        onSuccess={handleSuccess}
        debt={debt}
        isLender={isLender}
      />
    </div>
  );
}
