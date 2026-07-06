"use client";

import type { ReactNode } from "react";
import { Receipt } from "lucide-react";
import {
  Empty,
  EmptyContent,
  EmptyDescription,
  EmptyHeader,
  EmptyMedia,
  EmptyTitle,
} from "@/components/ui/empty";
import { ItemGroup } from "@/components/ui/item";
import { TabRow } from "./tab-row";
import type { Tab } from "./types";

export function TabList({
  tabs,
  emptyTitle,
  emptyDescription,
  emptyAction,
  onMarkPaid,
  onDelete,
}: {
  tabs: Tab[];
  emptyTitle: string;
  emptyDescription: string;
  emptyAction?: ReactNode;
  onMarkPaid: (tabId: number) => void;
  onDelete: (tabId: number) => void;
}) {
  if (tabs.length === 0) {
    return (
      <Empty className="border border-dashed">
        <EmptyHeader>
          <EmptyMedia variant="icon">
            <Receipt />
          </EmptyMedia>
          <EmptyTitle>{emptyTitle}</EmptyTitle>
          <EmptyDescription>{emptyDescription}</EmptyDescription>
        </EmptyHeader>
        {emptyAction && <EmptyContent>{emptyAction}</EmptyContent>}
      </Empty>
    );
  }

  return (
    <ItemGroup className="gap-3">
      {tabs.map((tab) => (
        <TabRow
          key={tab.id}
          tab={tab}
          onMarkPaid={onMarkPaid}
          onDelete={onDelete}
        />
      ))}
    </ItemGroup>
  );
}
