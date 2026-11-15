"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { Inbox } from "lucide-react";
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
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import {
  Empty,
  EmptyContent,
  EmptyDescription,
  EmptyHeader,
  EmptyMedia,
  EmptyTitle,
} from "@/components/ui/empty";
import {
  Item,
  ItemActions,
  ItemContent,
  ItemDescription,
  ItemGroup,
  ItemMedia,
  ItemTitle,
} from "@/components/ui/item";
import { Spinner } from "@/components/ui/spinner";
import {
  Pagination,
  PaginationContent,
  PaginationItem,
  PaginationPrevious,
  PaginationNext,
} from "@/components/ui/pagination";
import { pageBounds } from "../pagination";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { PageHeader } from "@/components/page-header";
import { StatusBadge } from "@/components/status-badge";
import { respondToTransaction } from "../actions";

type Transaction = {
  id: number;
  debtId: number;
  type: string;
  status: string;
  requesterId: string;
  lenderApproved: boolean;
  borrowerApproved: boolean;
  proposedAmount: number | null;
  proposedDescription: string | null;
  reason: string | null;
  createdAt: string | Date;
  debt: {
    id: number;
    amount: number;
    description: string | null;
    lenderId: string;
    borrowerId: string;
    lender: { id: string; name: string; email: string };
    borrower: { id: string; name: string; email: string };
    group: { id: number; name: string } | null;
  };
  requester: { id: string; name: string; email: string };
};

type RequestsPageClientProps = {
  initialTransactions: Transaction[];
  currentUserId: string;
};

type PendingConfirm = {
  transaction: Transaction;
  approve: boolean;
};

function initials(value: string): string {
  const parts = value.split(/[\s._@-]+/).filter(Boolean);
  const letters = (parts[0]?.[0] ?? "") + (parts[1]?.[0] ?? "");
  return (letters || value.slice(0, 2)).toUpperCase();
}

function getTypeLabel(type: string) {
  switch (type) {
    case "confirm_paid":
      return "Payment confirmation";
    case "modify":
      return "Change debt";
    case "drop":
      return "Delete debt";
    default:
      return type;
  }
}

export default function RequestsPageClient({
  initialTransactions,
  currentUserId,
}: RequestsPageClientProps) {
  const [transactions, setTransactions] =
    useState<Transaction[]>(initialTransactions);
  const [activeTab, setActiveTab] = useState<"inbox" | "waiting">("inbox");
  const [requestedPage, setRequestedPage] = useState(1);
  const [responding, setResponding] = useState<number | null>(null);
  const [confirm, setConfirm] = useState<PendingConfirm | null>(null);
  const router = useRouter();

  // Keep the local list in sync after router.refresh() re-fetches the page.
  useEffect(() => {
    setTransactions(initialTransactions);
  }, [initialTransactions]);

  const needsMyApproval = (transaction: Transaction) => {
    const isLender = transaction.debt.lenderId === currentUserId;
    const isBorrower = transaction.debt.borrowerId === currentUserId;

    if (isLender && !transaction.lenderApproved) return true;
    if (isBorrower && !transaction.borrowerApproved) return true;
    return false;
  };

  const inbox = transactions.filter(needsMyApproval);
  const waiting = transactions.filter((t) => !needsMyApproval(t));
  const activeRequests = activeTab === "inbox" ? inbox : waiting;
  const { page, pageCount, start, end } = pageBounds(
    activeRequests.length,
    requestedPage,
    5,
  );

  const respond = async (transaction: Transaction, approve: boolean) => {
    setResponding(transaction.id);
    const result = await respondToTransaction(transaction.id, approve);
    if (result.success) {
      setTransactions((prev) => prev.filter((t) => t.id !== transaction.id));
      toast.success(approve ? "Request approved" : "Request rejected");
      router.refresh();
    } else {
      const message =
        "error" in result && result.error
          ? result.error
          : "Failed to respond to request";
      toast.error(message);
    }
    setResponding(null);
  };

  const handleRespond = (transaction: Transaction, approve: boolean) => {
    // Rejecting and approving a deletion are destructive — confirm first.
    if (!approve || transaction.type === "drop") {
      setConfirm({ transaction, approve });
      return;
    }
    respond(transaction, approve);
  };

  const renderEmpty = (title: string, description: string) => (
    <Empty className="rounded-lg border py-12">
      <EmptyHeader>
        <EmptyMedia variant="icon">
          <Inbox />
        </EmptyMedia>
        <EmptyTitle>{title}</EmptyTitle>
        <EmptyDescription>{description}</EmptyDescription>
      </EmptyHeader>
      <EmptyContent>
        <Button variant="outline" asChild>
          <Link href="/debts">Back to debts</Link>
        </Button>
      </EmptyContent>
    </Empty>
  );

  const renderRow = (transaction: Transaction, canRespond: boolean) => {
    const isLender = transaction.debt.lenderId === currentUserId;
    const otherPerson = isLender
      ? transaction.debt.borrower
      : transaction.debt.lender;
    const isRequester = transaction.requesterId === currentUserId;
    const requesterName =
      transaction.requester.name || transaction.requester.email;
    const otherName = otherPerson.name || otherPerson.email;
    const isBusy = responding === transaction.id;

    const myApproval = isLender
      ? transaction.lenderApproved
      : transaction.borrowerApproved;
    const otherApproval = isLender
      ? transaction.borrowerApproved
      : transaction.lenderApproved;

    return (
      <Item key={transaction.id} variant="outline" className="items-start">
        <ItemMedia>
          <Avatar>
            <AvatarFallback>{initials(requesterName)}</AvatarFallback>
          </Avatar>
        </ItemMedia>
        <ItemContent className="min-w-0 gap-2">
          <ItemTitle className="flex-wrap">
            {getTypeLabel(transaction.type)}
            <span className="tabular-nums">
              {transaction.type === "modify" &&
              transaction.proposedAmount !== null ? (
                <>
                  <s className="text-muted-foreground">
                    <span className="sr-only">Current amount </span>$
                    {transaction.debt.amount.toFixed(2)}
                  </s>
                  <span aria-hidden="true"> → </span>
                  <span className="sr-only">Proposed amount </span>$
                  {transaction.proposedAmount.toFixed(2)}
                </>
              ) : (
                <>${transaction.debt.amount.toFixed(2)}</>
              )}
            </span>
          </ItemTitle>
          <ItemDescription className="line-clamp-none break-words">
            {isRequester ? "Requested by you" : `Requested by ${requesterName}`}
            {transaction.requesterId !== otherPerson.id &&
              ` · With ${otherName}`}
            {" · "}
            {new Date(transaction.createdAt).toLocaleDateString("en-US", {
              month: "short",
              day: "numeric",
              year: "numeric",
            })}
          </ItemDescription>
          {(transaction.debt.description || transaction.debt.group) && (
            <ItemDescription className="line-clamp-none break-words">
              {transaction.debt.description}
              {transaction.debt.description && transaction.debt.group && " · "}
              {transaction.debt.group?.name}
            </ItemDescription>
          )}
          {transaction.type === "modify" &&
            transaction.proposedDescription !== null && (
              <p className="break-words text-sm">
                New description: {transaction.proposedDescription || "(none)"}
              </p>
            )}
          {transaction.reason && (
            <p className="break-words text-sm">
              <span className="text-muted-foreground">Reason: </span>
              {transaction.reason}
            </p>
          )}
          <div className="flex flex-wrap gap-1.5 pt-1">
            <StatusBadge
              status={myApproval ? "approved" : "pending"}
              label={myApproval ? "You approved" : "Your approval needed"}
            />
            <StatusBadge
              status={otherApproval ? "approved" : "pending"}
              label={`${otherName}: ${otherApproval ? "approved" : "pending"}`}
            />
          </div>
        </ItemContent>
        <ItemActions className="w-full flex-wrap justify-end sm:w-auto">
          <Button variant="ghost" size="sm" asChild>
            <Link
              href={`/debts/${transaction.debtId}/requests/${transaction.id}`}
            >
              Review request
            </Link>
          </Button>
          {canRespond && (
            <>
              <Button
                variant="outline"
                size="sm"
                onClick={() => handleRespond(transaction, false)}
                disabled={isBusy}
              >
                Reject
              </Button>
              <Button
                size="sm"
                onClick={() => handleRespond(transaction, true)}
                disabled={isBusy}
              >
                {isBusy && <Spinner />}
                Approve
              </Button>
            </>
          )}
        </ItemActions>
      </Item>
    );
  };

  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        breadcrumbs={[
          { label: "Debts", href: "/debts" },
          { label: "Requests" },
        ]}
        title="Requests"
        description="Approve or reject pending changes to your debts."
      />

      <Tabs
        value={activeTab}
        onValueChange={(v) => {
          setActiveTab(v as "inbox" | "waiting");
          setRequestedPage(1);
        }}
      >
        <TabsList>
          <TabsTrigger value="inbox">
            Needs your approval ({inbox.length})
          </TabsTrigger>
          <TabsTrigger value="waiting">
            Waiting on others ({waiting.length})
          </TabsTrigger>
        </TabsList>

        <TabsContent value="inbox">
          {inbox.length === 0 ? (
            renderEmpty(
              "Nothing needs your approval",
              "You're all caught up! New requests from friends will land here.",
            )
          ) : (
            <ItemGroup className="gap-2">
              {inbox
                .slice(start, end)
                .map((transaction) => renderRow(transaction, true))}
            </ItemGroup>
          )}
        </TabsContent>

        <TabsContent value="waiting">
          {waiting.length === 0 ? (
            renderEmpty(
              "Nothing waiting on others",
              "Requests you have approved or created will wait here for the other party.",
            )
          ) : (
            <ItemGroup className="gap-2">
              {waiting
                .slice(start, end)
                .map((transaction) => renderRow(transaction, false))}
            </ItemGroup>
          )}
        </TabsContent>
        {activeRequests.length > 0 && (
          <div className="mt-4 flex flex-wrap items-center justify-between gap-3">
            <p className="text-sm text-muted-foreground" role="status">
              Showing {start + 1}-{end} of {activeRequests.length} requests
            </p>
            <Pagination className="mx-0 w-auto" aria-label="Request pages">
              <PaginationContent>
                <PaginationItem>
                  <PaginationPrevious
                    href="#"
                    aria-disabled={page === 1}
                    tabIndex={page === 1 ? -1 : undefined}
                    className={
                      page === 1 ? "pointer-events-none opacity-50" : undefined
                    }
                    onClick={(event) => {
                      event.preventDefault();
                      if (page > 1) setRequestedPage(page - 1);
                    }}
                  />
                </PaginationItem>
                <PaginationItem>
                  <span className="px-2 text-sm">
                    Page {page} of {pageCount}
                  </span>
                </PaginationItem>
                <PaginationItem>
                  <PaginationNext
                    href="#"
                    aria-disabled={page === pageCount}
                    tabIndex={page === pageCount ? -1 : undefined}
                    className={
                      page === pageCount
                        ? "pointer-events-none opacity-50"
                        : undefined
                    }
                    onClick={(event) => {
                      event.preventDefault();
                      if (page < pageCount) setRequestedPage(page + 1);
                    }}
                  />
                </PaginationItem>
              </PaginationContent>
            </Pagination>
          </div>
        )}
      </Tabs>

      <AlertDialog
        open={confirm !== null}
        onOpenChange={(open) => {
          if (!open) setConfirm(null);
        }}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>
              {confirm?.approve
                ? "Approve this deletion?"
                : "Reject this request?"}
            </AlertDialogTitle>
            <AlertDialogDescription>
              {confirm?.approve
                ? `This will permanently remove the $${confirm.transaction.debt.amount.toFixed(2)} debt. This cannot be undone.`
                : "The request will be declined and the other party will be notified. They can submit a new request later."}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => {
                if (confirm) {
                  respond(confirm.transaction, confirm.approve);
                }
                setConfirm(null);
              }}
            >
              {confirm?.approve ? "Approve deletion" : "Reject request"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
