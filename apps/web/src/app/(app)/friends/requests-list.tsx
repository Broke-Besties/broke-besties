"use client";

import { Fragment, useState } from "react";

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
import { Button } from "@/components/ui/button";
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
  ItemSeparator,
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
    <div className="flex flex-col gap-6">
      <section className="flex flex-col gap-3">
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
          <ItemGroup className="overflow-hidden rounded-lg border">
            {pendingRequests.map((request, index) => (
              <Fragment key={request.id}>
                {index > 0 && <ItemSeparator />}
                <IncomingRequestRow
                  request={request}
                  pending={pending}
                  onAccept={() => onAccept(request.id)}
                  onReject={() => onReject(request.id)}
                />
              </Fragment>
            ))}
          </ItemGroup>
        )}
      </section>

      <section className="flex flex-col gap-3">
        <SectionHeader title="Sent" count={sentRequests.length} />
        {sentRequests.length === 0 ? (
          <CompactEmpty
            title="No sent requests"
            description="Requests you send will wait here until they are accepted."
          />
        ) : (
          <ItemGroup className="overflow-hidden rounded-lg border">
            {sentRequests.map((request, index) => {
              const cancelling =
                pending?.action === "cancel" && pending.id === request.id;
              return (
                <Fragment key={request.id}>
                  {index > 0 && <ItemSeparator />}
                  <Item
                    size="sm"
                    role="listitem"
                    className="flex-nowrap rounded-none"
                  >
                    <ItemMedia>
                      <Avatar className="size-10">
                        <AvatarFallback>
                          {initials(request.recipient.name)}
                        </AvatarFallback>
                      </Avatar>
                    </ItemMedia>
                    <ItemContent className="min-w-0">
                      <ItemTitle className="max-w-full [overflow-wrap:anywhere]">
                        {request.recipient.name}
                      </ItemTitle>
                      <ItemDescription className="line-clamp-none [overflow-wrap:anywhere]">
                        {request.recipient.email}
                      </ItemDescription>
                    </ItemContent>
                    <ItemActions>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => onCancel(request.id)}
                        disabled={pending !== null}
                      >
                        {cancelling && <Spinner />}
                        Cancel
                      </Button>
                    </ItemActions>
                  </Item>
                </Fragment>
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
  const busy = pending !== null;

  return (
    <>
      <Item
        size="sm"
        role="listitem"
        className="grid grid-cols-[auto_minmax(0,1fr)] rounded-none sm:flex sm:flex-nowrap"
      >
        <ItemMedia>
          <Avatar className="size-10">
            <AvatarFallback>{initials(request.requester.name)}</AvatarFallback>
          </Avatar>
        </ItemMedia>
        <ItemContent className="min-w-0">
          <ItemTitle className="max-w-full [overflow-wrap:anywhere]">
            {request.requester.name}
          </ItemTitle>
          <ItemDescription className="line-clamp-none [overflow-wrap:anywhere]">
            {request.requester.email}
          </ItemDescription>
        </ItemContent>
        <ItemActions className="col-span-2 justify-end sm:shrink-0">
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
              variant="destructive"
              disabled={busy}
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
