"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { AlertCircle, CheckCircle2, Trash2 } from "lucide-react";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
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
  ItemDescription,
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
  const isPending = transaction.status === "pending";
  const needsMyApproval =
    isPending &&
    ((isLender && !transaction.lenderApproved) ||
      (isBorrower && !transaction.borrowerApproved));
  const isRequester = transaction.requester.id === currentUserId;
  const otherPerson = isLender ? debt.borrower : debt.lender;

  const amount = `$${debt.amount.toFixed(2)}`;
  const approveLabel =
    transaction.type === "confirm_paid"
      ? "Mark as paid"
      : transaction.type === "drop"
        ? "Delete debt"
        : transaction.type === "modify"
          ? "Accept changes"
          : "Approve request";
  const question =
    transaction.type === "confirm_paid"
      ? `Has the ${amount} debt been paid?`
      : transaction.type === "drop"
        ? `Delete the ${amount} debt?`
        : "Review the proposed changes";

  const respond = async (approve: boolean) => {
    setPending(approve ? "approve" : "reject");
    const result = await respondToDebtTransaction(transaction.id, approve);
    if (result.success) {
      toast.success(approve ? "Request approved" : "Request rejected");
      if (
        approve &&
        transaction.type === "drop" &&
        "debtUpdated" in result &&
        result.debtUpdated
      ) {
        router.replace("/debts/requests");
        return;
      }
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
    // Approving a deletion is destructive - confirm first.
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
        <StatusBadge
          status={transaction.status}
          label={
            isPending
              ? needsMyApproval
                ? "Needs your review"
                : "Waiting on the other person"
              : transaction.status
          }
          className="w-fit"
        />
        <CardTitle>
          {isPending ? question : transactionTypeLabel(transaction.type)}
        </CardTitle>
        <CardDescription>
          Requested by {displayName(transaction.requester)} on{" "}
          {new Date(transaction.createdAt).toLocaleDateString("en-US", {
            month: "short",
            day: "numeric",
            year: "numeric",
          })}
          .
          {transaction.resolvedAt &&
            ` Resolved on ${new Date(transaction.resolvedAt).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })}.`}
        </CardDescription>
      </CardHeader>
      <CardContent className="flex flex-col gap-4">
        <ItemGroup className="gap-3">
          <Item variant="muted">
            <ItemContent className="min-w-0">
              <ItemTitle>{debt.description || "Debt"}</ItemTitle>
              <ItemDescription className="line-clamp-none break-words">
                {isLender
                  ? `${displayName(otherPerson)} borrowed ${amount} from you.`
                  : `You borrowed ${amount} from ${displayName(otherPerson)}.`}
                {debt.group && ` Group: ${debt.group.name}.`}
              </ItemDescription>
            </ItemContent>
          </Item>
          {transaction.type === "modify" &&
            transaction.proposedAmount !== null && (
              <Item variant="outline">
                <ItemContent className="min-w-0">
                  <ItemTitle>
                    {isPending ? "Amount change" : "Requested amount"}
                  </ItemTitle>
                  <p className="text-sm tabular-nums">
                    {isPending && (
                      <>
                        Current: {amount}
                        <br />
                      </>
                    )}
                    Requested: ${transaction.proposedAmount.toFixed(2)}
                  </p>
                </ItemContent>
              </Item>
            )}
          {transaction.type === "modify" &&
            transaction.proposedDescription !== null && (
              <Item variant="outline">
                <ItemContent className="min-w-0">
                  <ItemTitle>
                    {isPending ? "Description change" : "Requested description"}
                  </ItemTitle>
                  <p className="break-words text-sm">
                    {isPending && (
                      <>
                        Current: {debt.description || "(none)"}
                        <br />
                      </>
                    )}
                    Requested: {transaction.proposedDescription || "(none)"}
                  </p>
                </ItemContent>
              </Item>
            )}
          {transaction.reason && (
            <Item variant="outline">
              <ItemContent className="min-w-0">
                <ItemTitle>
                  {isRequester
                    ? "Your reason"
                    : `${displayName(transaction.requester)}’s reason`}
                </ItemTitle>
                <p className="break-words text-sm">{transaction.reason}</p>
              </ItemContent>
            </Item>
          )}
        </ItemGroup>
        {isPending && (
          <Alert>
            {transaction.type === "drop" ? (
              <Trash2 />
            ) : transaction.type === "confirm_paid" ? (
              <CheckCircle2 />
            ) : (
              <AlertCircle />
            )}
            <AlertTitle>
              {transaction.type === "drop"
                ? "Deleting is permanent"
                : "What accepting means"}
            </AlertTitle>
            <AlertDescription>
              {transaction.type === "drop"
                ? "The debt and its request history will be permanently removed. This cannot be undone."
                : transaction.type === "confirm_paid"
                  ? "The debt will be marked as paid. This records a payment; it does not transfer money."
                  : "The requested changes will replace the current debt details once both people approve."}
            </AlertDescription>
          </Alert>
        )}
      </CardContent>
      {isPending && (
        <CardFooter className="flex-wrap justify-between gap-2">
          <div className="text-sm text-muted-foreground">
            {!needsMyApproval &&
              `You approved. Waiting for ${displayName(otherPerson)} to respond.`}
          </div>
          <div className="flex flex-wrap items-center gap-2">
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
                  Decline request
                </Button>
                <Button
                  variant={
                    transaction.type === "drop" ? "destructive" : "default"
                  }
                  onClick={handleApprove}
                  disabled={pending !== null}
                >
                  {pending === "approve" && <Spinner />}
                  {approveLabel}
                </Button>
              </>
            )}
          </div>
        </CardFooter>
      )}

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
                ? "Delete this debt?"
                : "Decline this request?"}
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
              {confirmAction === "approve" ? "Delete debt" : "Decline request"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </Card>
  );
}
