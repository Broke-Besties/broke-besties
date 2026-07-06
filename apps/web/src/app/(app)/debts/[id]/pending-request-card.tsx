"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  Item,
  ItemContent,
  ItemGroup,
  ItemTitle,
} from "@/components/ui/item";
import { Spinner } from "@/components/ui/spinner";
import { StatusBadge } from "@/components/status-badge";
import {
  cancelDebtTransaction,
  respondToDebtTransaction,
} from "@/app/(app)/groups/[id]/actions";
import {
  displayName,
  transactionTypeLabel,
  type DebtDetail,
  type DebtTransactionRecord,
} from "./types";

type PendingAction = "approve" | "reject" | "cancel";

export function PendingRequestCard({
  transaction,
  debt,
  currentUserId,
}: {
  transaction: DebtTransactionRecord;
  debt: DebtDetail;
  currentUserId: string;
}) {
  const router = useRouter();
  const [pending, setPending] = useState<PendingAction | null>(null);
  const [confirmAction, setConfirmAction] = useState<
    "approve" | "reject" | null
  >(null);

  const isLender = debt.lender.id === currentUserId;
  const isBorrower = debt.borrower.id === currentUserId;
  const needsMyApproval =
    (isLender && !transaction.lenderApproved) ||
    (isBorrower && !transaction.borrowerApproved);
  const isRequester = transaction.requester.id === currentUserId;
  const otherPerson = isLender ? debt.borrower : debt.lender;

  const respond = async (approve: boolean) => {
    setPending(approve ? "approve" : "reject");
    const result = await respondToDebtTransaction(transaction.id, approve);
    if (result.success) {
      toast.success(approve ? "Request approved" : "Request rejected");
      router.refresh();
    } else {
      const message =
        "error" in result && result.error
          ? result.error
          : "Failed to respond to request";
      toast.error(message);
    }
    setPending(null);
  };

  const handleApprove = () => {
    // Approving a deletion is destructive — confirm first.
    if (transaction.type === "drop") {
      setConfirmAction("approve");
      return;
    }
    respond(true);
  };

  const handleReject = () => {
    setConfirmAction("reject");
  };

  const handleCancel = async () => {
    setPending("cancel");
    const result = await cancelDebtTransaction(transaction.id);
    if (result.success) {
      toast.success("Request cancelled");
      router.refresh();
    } else {
      const message =
        "error" in result && result.error
          ? result.error
          : "Failed to cancel request";
      toast.error(message);
    }
    setPending(null);
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle>{transactionTypeLabel(transaction.type)} pending</CardTitle>
        <CardDescription>
          Requested by {displayName(transaction.requester)} · both parties must
          approve before it takes effect.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <ItemGroup className="gap-0 rounded-lg border">
          {transaction.type === "modify" &&
            transaction.proposedAmount !== null && (
              <Item size="sm">
                <ItemContent>
                  <ItemTitle className="font-normal text-muted-foreground">
                    Amount
                  </ItemTitle>
                </ItemContent>
                <span className="text-sm font-medium tabular-nums">
                  ${debt.amount.toFixed(2)} → $
                  {transaction.proposedAmount.toFixed(2)}
                </span>
              </Item>
            )}
          {transaction.type === "modify" &&
            transaction.proposedDescription !== null && (
              <Item size="sm">
                <ItemContent>
                  <ItemTitle className="font-normal text-muted-foreground">
                    Description
                  </ItemTitle>
                </ItemContent>
                <span className="text-sm">
                  {debt.description || "(none)"} →{" "}
                  {transaction.proposedDescription || "(none)"}
                </span>
              </Item>
            )}
          {transaction.type === "drop" && (
            <Item size="sm">
              <ItemContent>
                <ItemTitle className="font-normal text-muted-foreground">
                  Proposal
                </ItemTitle>
              </ItemContent>
              <span className="text-sm">
                Delete this ${debt.amount.toFixed(2)} debt
              </span>
            </Item>
          )}
          {transaction.type === "confirm_paid" && (
            <Item size="sm">
              <ItemContent>
                <ItemTitle className="font-normal text-muted-foreground">
                  Proposal
                </ItemTitle>
              </ItemContent>
              <span className="text-sm">
                Mark this ${debt.amount.toFixed(2)} debt as paid
              </span>
            </Item>
          )}
          {transaction.reason && (
            <Item size="sm">
              <ItemContent>
                <ItemTitle className="font-normal text-muted-foreground">
                  Reason
                </ItemTitle>
              </ItemContent>
              <span className="text-sm">{transaction.reason}</span>
            </Item>
          )}
        </ItemGroup>

        <div className="flex flex-wrap gap-1.5">
          <StatusBadge
            status={transaction.lenderApproved ? "approved" : "pending"}
            label={transaction.lenderApproved ? "Lender ✓" : "Lender pending"}
          />
          <StatusBadge
            status={transaction.borrowerApproved ? "approved" : "pending"}
            label={
              transaction.borrowerApproved ? "Borrower ✓" : "Borrower pending"
            }
          />
        </div>
      </CardContent>
      <CardFooter className="justify-between gap-2">
        <div className="text-sm text-muted-foreground">
          {!needsMyApproval &&
            `Waiting for ${displayName(otherPerson)} to respond.`}
        </div>
        <div className="flex items-center gap-2">
          {isRequester && (
            <Button
              variant="ghost"
              onClick={handleCancel}
              disabled={pending !== null}
            >
              {pending === "cancel" && <Spinner />}
              Cancel request
            </Button>
          )}
          {needsMyApproval && (
            <>
              <Button
                variant="outline"
                onClick={handleReject}
                disabled={pending !== null}
              >
                {pending === "reject" && <Spinner />}
                Reject
              </Button>
              <Button onClick={handleApprove} disabled={pending !== null}>
                {pending === "approve" && <Spinner />}
                Approve
              </Button>
            </>
          )}
        </div>
      </CardFooter>

      <AlertDialog
        open={confirmAction !== null}
        onOpenChange={(open) => {
          if (!open) setConfirmAction(null);
        }}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>
              {confirmAction === "approve"
                ? "Approve this deletion?"
                : "Reject this request?"}
            </AlertDialogTitle>
            <AlertDialogDescription>
              {confirmAction === "approve"
                ? `This will permanently remove the $${debt.amount.toFixed(2)} debt. This cannot be undone.`
                : "The request will be declined and the other party will be notified. They can submit a new request later."}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => {
                respond(confirmAction === "approve");
                setConfirmAction(null);
              }}
            >
              {confirmAction === "approve"
                ? "Approve deletion"
                : "Reject request"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </Card>
  );
}
