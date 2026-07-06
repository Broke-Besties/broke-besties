"use client";

import { useState } from "react";
import { MoreHorizontal } from "lucide-react";
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
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Item,
  ItemActions,
  ItemContent,
  ItemDescription,
  ItemMedia,
  ItemTitle,
} from "@/components/ui/item";
import { StatusBadge } from "@/components/status-badge";
import type { Tab } from "./types";

// The tab data model stores direction (lending/borrowing) and lifecycle in
// one `status` field, so marking a tab paid destroys who-owed-whom. Paid
// rows can only show "Paid" until the model records the pre-paid direction.
const STATUS_LABELS: Record<string, string> = {
  borrowing: "You owe",
  lending: "Owes you",
  paid: "Paid",
};

function initials(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return "?";
  return parts
    .slice(0, 2)
    .map((part) => part.charAt(0).toUpperCase())
    .join("");
}

export function TabRow({
  tab,
  onMarkPaid,
  onDelete,
}: {
  tab: Tab;
  onMarkPaid: (tabId: number) => void;
  onDelete: (tabId: number) => void;
}) {
  const [confirmingDelete, setConfirmingDelete] = useState(false);
  const isPaid = tab.status === "paid";
  const deleteLabel = isPaid ? "Remove" : "Delete";

  return (
    <>
      <Item variant="outline">
        <ItemMedia>
          <Avatar>
            <AvatarFallback>{initials(tab.personName)}</AvatarFallback>
          </Avatar>
        </ItemMedia>
        <ItemContent>
          <ItemTitle>
            {tab.personName}
            <StatusBadge
              status={tab.status}
              label={STATUS_LABELS[tab.status] ?? tab.status}
            />
          </ItemTitle>
          <ItemDescription>{tab.description}</ItemDescription>
        </ItemContent>
        <div className="flex flex-col items-end gap-0.5 text-right">
          <span className="text-sm font-medium tabular-nums">
            ${tab.amount.toFixed(2)}
          </span>
          <span className="text-xs text-muted-foreground">
            Added{" "}
            {new Date(tab.createdAt).toLocaleDateString("en-US", {
              year: "numeric",
              month: "short",
              day: "numeric",
            })}
          </span>
        </div>
        <ItemActions>
          {!isPaid && (
            <Button
              variant="outline"
              size="sm"
              onClick={() => onMarkPaid(tab.id)}
            >
              Mark paid
            </Button>
          )}
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="ghost" size="icon" aria-label="More actions">
                <MoreHorizontal />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              <DropdownMenuItem
                variant="destructive"
                onSelect={() => setConfirmingDelete(true)}
              >
                {deleteLabel}
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </ItemActions>
      </Item>

      <AlertDialog open={confirmingDelete} onOpenChange={setConfirmingDelete}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{deleteLabel} this tab?</AlertDialogTitle>
            <AlertDialogDescription>
              This permanently deletes the ${tab.amount.toFixed(2)} tab with{" "}
              {tab.personName}. This action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              variant="destructive"
              onClick={() => onDelete(tab.id)}
            >
              {deleteLabel}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
