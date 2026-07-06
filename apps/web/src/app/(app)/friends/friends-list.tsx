"use client";

import { useState } from "react";
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
import { Button, buttonVariants } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
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
  ItemTitle,
} from "@/components/ui/item";
import { Spinner } from "@/components/ui/spinner";
import { initials } from "./initials";
import type { Friend, PendingAction } from "./types";

type FriendsListProps = {
  friends: Friend[];
  pending: PendingAction | null;
  onRemove: (friendshipId: number) => void;
  onAddFriend: () => void;
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
          <Button onClick={onAddFriend}>
            <UserPlus />
            Add a friend
          </Button>
        </EmptyContent>
      </Empty>
    );
  }

  return (
    <ItemGroup className="gap-3">
      {friends.map((friendship) => (
        <FriendRow
          key={friendship.id}
          friendship={friendship}
          removing={
            pending?.action === "remove" && pending.id === friendship.id
          }
          onRemove={() => onRemove(friendship.id)}
        />
      ))}
    </ItemGroup>
  );
}

function FriendRow({
  friendship,
  removing,
  onRemove,
}: {
  friendship: Friend;
  removing: boolean;
  onRemove: () => void;
}) {
  const [confirmOpen, setConfirmOpen] = useState(false);

  return (
    <>
      <Item variant="outline">
        <ItemMedia>
          <Avatar className="size-10">
            <AvatarFallback>{initials(friendship.friend.name)}</AvatarFallback>
          </Avatar>
        </ItemMedia>
        <ItemContent>
          <ItemTitle>{friendship.friend.name}</ItemTitle>
          <ItemDescription>{friendship.friend.email}</ItemDescription>
        </ItemContent>
        <ItemActions>
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button
                variant="ghost"
                size="icon"
                disabled={removing}
                aria-label="Friend actions"
              >
                {removing ? <Spinner /> : <MoreHorizontal />}
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              <DropdownMenuItem
                variant="destructive"
                onSelect={() => setConfirmOpen(true)}
              >
                Remove friend
              </DropdownMenuItem>
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
              className={buttonVariants({ variant: "destructive" })}
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
