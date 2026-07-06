"use client";

import { useState } from "react";

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
import { Badge } from "@/components/ui/badge";
import { Button, buttonVariants } from "@/components/ui/button";
import {
  Empty,
  EmptyDescription,
  EmptyHeader,
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
import { initials } from "./initials";
import type { FriendRequest, PendingAction } from "./types";

type RequestsListProps = {
  pendingRequests: FriendRequest[];
  sentRequests: FriendRequest[];
  pending: PendingAction | null;
  onAccept: (requestId: number) => void;
  onReject: (requestId: number) => void;
  onCancel: (requestId: number) => void;
};

export function RequestsList({
  pendingRequests,
  sentRequests,
  pending,
  onAccept,
  onReject,
  onCancel,
}: RequestsListProps) {
  return (
    <div className="space-y-6">
      <section className="space-y-3">
        <SectionHeader
          title="Needs your response"
          count={pendingRequests.length}
        />
        {pendingRequests.length === 0 ? (
          <CompactEmpty
            title="No incoming requests"
            description="Friend requests sent to you will show up here."
          />
        ) : (
          <ItemGroup className="gap-3">
            {pendingRequests.map((request) => (
              <IncomingRequestRow
                key={request.id}
                request={request}
                pending={pending}
                onAccept={() => onAccept(request.id)}
                onReject={() => onReject(request.id)}
              />
            ))}
          </ItemGroup>
        )}
      </section>

      <section className="space-y-3">
        <SectionHeader title="Sent" count={sentRequests.length} />
        {sentRequests.length === 0 ? (
          <CompactEmpty
            title="No sent requests"
            description="Requests you send will wait here until they are accepted."
          />
        ) : (
          <ItemGroup className="gap-3">
            {sentRequests.map((request) => {
              const cancelling =
                pending?.action === "cancel" && pending.id === request.id;
              return (
                <Item key={request.id} variant="outline">
                  <ItemMedia>
                    <Avatar className="size-10">
                      <AvatarFallback>
                        {initials(request.recipient.name)}
                      </AvatarFallback>
                    </Avatar>
                  </ItemMedia>
                  <ItemContent>
                    <ItemTitle>{request.recipient.name}</ItemTitle>
                    <ItemDescription>{request.recipient.email}</ItemDescription>
                  </ItemContent>
                  <ItemActions>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => onCancel(request.id)}
                      disabled={cancelling}
                    >
                      {cancelling && <Spinner />}
                      Cancel
                    </Button>
                  </ItemActions>
                </Item>
              );
            })}
          </ItemGroup>
        )}
      </section>
    </div>
  );
}

function SectionHeader({ title, count }: { title: string; count: number }) {
  return (
    <div className="flex items-center gap-2">
      <h2 className="text-sm font-medium">{title}</h2>
      <Badge variant="secondary">{count}</Badge>
    </div>
  );
}

function CompactEmpty({
  title,
  description,
}: {
  title: string;
  description: string;
}) {
  return (
    <Empty className="gap-2 border border-dashed p-6 md:p-6">
      <EmptyHeader>
        <EmptyTitle className="text-sm">{title}</EmptyTitle>
        <EmptyDescription>{description}</EmptyDescription>
      </EmptyHeader>
    </Empty>
  );
}

function IncomingRequestRow({
  request,
  pending,
  onAccept,
  onReject,
}: {
  request: FriendRequest;
  pending: PendingAction | null;
  onAccept: () => void;
  onReject: () => void;
}) {
  const [confirmOpen, setConfirmOpen] = useState(false);
  const accepting = pending?.action === "accept" && pending.id === request.id;
  const rejecting = pending?.action === "reject" && pending.id === request.id;
  const busy = accepting || rejecting;

  return (
    <>
      <Item variant="outline">
        <ItemMedia>
          <Avatar className="size-10">
            <AvatarFallback>{initials(request.requester.name)}</AvatarFallback>
          </Avatar>
        </ItemMedia>
        <ItemContent>
          <ItemTitle>{request.requester.name}</ItemTitle>
          <ItemDescription>{request.requester.email}</ItemDescription>
        </ItemContent>
        <ItemActions>
          <Button
            variant="outline"
            size="sm"
            onClick={() => setConfirmOpen(true)}
            disabled={busy}
          >
            {rejecting && <Spinner />}
            Reject
          </Button>
          <Button size="sm" onClick={onAccept} disabled={busy}>
            {accepting && <Spinner />}
            Accept
          </Button>
        </ItemActions>
      </Item>

      <AlertDialog open={confirmOpen} onOpenChange={setConfirmOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Reject friend request?</AlertDialogTitle>
            <AlertDialogDescription>
              {request.requester.name} will be notified that you declined their
              request.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              className={buttonVariants({ variant: "destructive" })}
              onClick={onReject}
            >
              Reject request
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
