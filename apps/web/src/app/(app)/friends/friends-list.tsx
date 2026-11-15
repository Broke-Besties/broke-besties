"use client";

import { Fragment, useState } from "react";
import { MoreHorizontal, UserPlus, Users } from "lucide-react";

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
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuGroup,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
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
  ItemSeparator,
  ItemTitle,
} from "@/components/ui/item";
import { Spinner } from "@/components/ui/spinner";
import { initials } from "./initials";
import type { Friend, PendingAction } from "./types";

type FriendsListProps = {
  friends: Friend[];
  pending: PendingAction | null;
  onRemove: (friendshipId: number) => void;
  onAddFriend: React.MouseEventHandler<HTMLButtonElement>;
};

export function FriendsList({
  friends,
  pending,
  onRemove,
  onAddFriend,
}: FriendsListProps) {
  if (friends.length === 0) {
    return (
      <Empty className="border border-dashed">
        <EmptyHeader>
          <EmptyMedia variant="icon">
            <Users />
          </EmptyMedia>
          <EmptyTitle>No friends yet</EmptyTitle>
          <EmptyDescription>
            Add friends using their email address.
          </EmptyDescription>
        </EmptyHeader>
        <EmptyContent>
          <Button onClick={onAddFriend} disabled={pending !== null}>
            <UserPlus />
            Add a friend
          </Button>
        </EmptyContent>
      </Empty>
    );
  }

  return (
    <ItemGroup className="overflow-hidden rounded-lg border">
      {friends.map((friendship, index) => (
        <Fragment key={friendship.id}>
          {index > 0 && <ItemSeparator />}
          <FriendRow
            disabled={pending !== null}
            friendship={friendship}
            removing={
              pending?.action === "remove" && pending.id === friendship.id
            }
            onRemove={() => onRemove(friendship.id)}
          />
        </Fragment>
      ))}
    </ItemGroup>
  );
}

function FriendRow({
  friendship,
  removing,
  disabled,
  onRemove,
}: {
  friendship: Friend;
  removing: boolean;
  disabled: boolean;
  onRemove: () => void;
}) {
  const [confirmOpen, setConfirmOpen] = useState(false);

  return (
    <>
      <Item size="sm" role="listitem" className="flex-nowrap rounded-none">
        <ItemMedia>
          <Avatar className="size-10">
            <AvatarFallback>{initials(friendship.friend.name)}</AvatarFallback>
          </Avatar>
        </ItemMedia>
        <ItemContent className="min-w-0">
          <ItemTitle className="max-w-full [overflow-wrap:anywhere]">
            {friendship.friend.name}
          </ItemTitle>
          <ItemDescription className="line-clamp-none [overflow-wrap:anywhere]">
            {friendship.friend.email}
          </ItemDescription>
          {friendship.friend.signedUp === false && (
            <Badge
              variant="secondary"
              className="w-fit max-w-full whitespace-normal"
            >
              Not signed up yet
            </Badge>
          )}
        </ItemContent>
        <ItemActions>
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button
                variant="ghost"
                size="icon"
                disabled={disabled}
                aria-label={`Actions for ${friendship.friend.name}`}
              >
                {removing ? <Spinner /> : <MoreHorizontal />}
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              <DropdownMenuGroup>
                <DropdownMenuItem
                  variant="destructive"
                  disabled={disabled}
                  onSelect={() => setConfirmOpen(true)}
                >
                  Remove friend
                </DropdownMenuItem>
              </DropdownMenuGroup>
            </DropdownMenuContent>
          </DropdownMenu>
        </ItemActions>
      </Item>

      <AlertDialog open={confirmOpen} onOpenChange={setConfirmOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Remove friend?</AlertDialogTitle>
            <AlertDialogDescription>
              This will remove {friendship.friend.name} from your friends. You
              can always send a new friend request later.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              variant="destructive"
              disabled={disabled}
              onClick={onRemove}
            >
              Remove friend
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
