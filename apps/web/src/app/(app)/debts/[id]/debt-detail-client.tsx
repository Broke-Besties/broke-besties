"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import {
  Calendar,
  CheckCircle2,
  ChevronDown,
  Pencil,
  Trash2,
  Users,
} from "lucide-react";
import { toast } from "sonner";
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
import { Spinner } from "@/components/ui/spinner";
import { PageHeader } from "@/components/page-header";
import { StatusBadge } from "@/components/status-badge";
import type { DebtPaypalInfo } from "@/services/paypal.service";
import { ConfirmPaidModal } from "../confirm-paid-modal";
import { ModifyDebtModal } from "../modify-debt-modal";
import { DeleteDebtModal } from "../delete-debt-modal";
import { ActivityCard } from "./activity-card";
import { PendingRequestCard } from "./pending-request-card";
import { ReceiptsCard } from "./receipts-card";
import { ReminderCard } from "./reminder-card";
import { paypalCaptureToast, type PaypalReturn } from "./paypal";
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
  paypal: DebtPaypalInfo;
  paypalReturn: PaypalReturn | null;
};

export default function DebtDetailClient({
  debt,
  transactions,
  currentUserId,
  receiptImageUrls,
  paypal,
  paypalReturn,
}: DebtDetailClientProps) {
  const router = useRouter();
  const [activeModal, setActiveModal] = useState<ModalType>(null);
  const [paypalOpening, setPaypalOpening] = useState(false);
  const paypalReturnHandled = useRef(false);

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

  // Coming back from PayPal Checkout (?paypal=approved|cancelled&pp=). The ref
  // keeps StrictMode's double effect run in dev from capturing twice.
  const paypalConfirming = paypalReturn?.status === "approved";
  useEffect(() => {
    if (!paypalReturn || paypalReturnHandled.current) return;
    paypalReturnHandled.current = true;

    const page = window.location.pathname;
    const finish = () => {
      // Don't drag the user back if they navigated away mid-capture.
      if (window.location.pathname !== page) return;
      router.replace(`/debts/${debt.id}`, { scroll: false });
      router.refresh();
    };

    if (paypalReturn.status === "cancelled") {
      toast("PayPal payment cancelled");
      finish();
      return;
    }

    fetch(`/api/paypal/payments/${paypalReturn.paymentId}/capture`, {
      method: "POST",
    })
      .then(async (response) => {
        const { tone, message } = paypalCaptureToast(
          response.status,
          await response.json().catch(() => ({})),
          lenderName,
        );
        if (tone === "success") toast.success(message);
        else if (tone === "error") toast.error(message);
        else toast(message);
      })
      .catch(() => toast.error("Couldn't confirm your PayPal payment"))
      .finally(finish);
  }, [paypalReturn, debt.id, lenderName, router]);

  const handlePayWithPaypal = async () => {
    setPaypalOpening(true);
    try {
      const response = await fetch(`/api/debts/${debt.id}/paypal/order`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ platform: "web" }),
      });
      const data = await response.json();
      // A 409 for a payment already in progress carries its approveUrl: resume it.
      if ((response.ok || response.status === 409) && data.approveUrl) {
        window.location.assign(data.approveUrl);
      } else {
        toast.error(data.error || "Couldn't start PayPal. Try again.");
        router.refresh(); // the debt may have changed (paid, request pending, payment processing)
      }
    } catch {
      toast.error("Couldn't start PayPal. Try again.");
    } finally {
      // ponytail: re-enables as soon as the redirect starts so a bfcache Back
      // can't restore a stuck spinner; a second click just resumes the same
      // order (409 + approveUrl). Keep it busy + reset on `pageshow` if needed.
      setPaypalOpening(false);
    }
  };

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
              {paypal.canPay && (
                <Button
                  variant="outline"
                  onClick={handlePayWithPaypal}
                  disabled={paypalOpening || paypalConfirming}
                >
                  {(paypalOpening || paypalConfirming) && <Spinner />}
                  {paypalConfirming
                    ? "Confirming payment…"
                    : paypalOpening
                      ? "Opening PayPal…"
                      : `Pay ${amountLabel} with PayPal`}
                </Button>
              )}
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

              {isBorrower &&
                debt.status === "pending" &&
                paypal.payments.some((p) => p.status === "APPROVED") && (
                  <p className="max-w-sm text-sm text-muted-foreground">
                    PayPal is processing your payment. We&apos;ll mark this debt
                    paid when it clears.
                  </p>
                )}

              {paypal.enabled && isBorrower && canAct && !paypal.lenderConnected && (
                <p className="max-w-sm text-sm text-muted-foreground">
                  {lenderName} hasn&apos;t connected PayPal
                </p>
              )}
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
