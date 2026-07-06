"use client";

import { useState } from "react";
import { HandCoins, Plus, Scale, Wallet } from "lucide-react";
import { toast } from "sonner";
import { PageHeader } from "@/components/page-header";
import { StatCard } from "@/components/stat-card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { deleteTab, updateTab } from "./actions";
import { CreateTabDialog } from "./create-tab-dialog";
import { TabList } from "./tab-list";
import type { Tab, TabDirection } from "./types";

function formatCurrency(value: number): string {
  const absolute = Math.abs(value).toFixed(2);
  return value < 0 ? `-$${absolute}` : `$${absolute}`;
}

export default function TabsPageClient({
  initialTabs,
  autoOpenCreate = false,
}: {
  initialTabs: Tab[];
  autoOpenCreate?: boolean;
}) {
  const [tabs, setTabs] = useState<Tab[]>(initialTabs);
  const [activeTab, setActiveTab] = useState("borrowing");
  const [createOpen, setCreateOpen] = useState(autoOpenCreate);
  const [createDirection, setCreateDirection] =
    useState<TabDirection>("borrowing");

  const openCreate = (direction: TabDirection) => {
    setCreateDirection(direction);
    setCreateOpen(true);
  };

  const handleMarkPaid = async (tabId: number) => {
    const originalTab = tabs.find((tab) => tab.id === tabId);
    if (!originalTab) return;
    const originalStatus = originalTab.status;

    // Optimistically update, revert in place on failure.
    setTabs((prevTabs) =>
      prevTabs.map((tab) =>
        tab.id === tabId ? { ...tab, status: "paid" } : tab
      )
    );

    const revert = () =>
      setTabs((prevTabs) =>
        prevTabs.map((tab) =>
          tab.id === tabId ? { ...tab, status: originalStatus } : tab
        )
      );

    try {
      const result = await updateTab(tabId, { status: "paid" });
      if (!result.success) {
        revert();
        toast.error(result.error || "Failed to mark the tab as paid");
        return;
      }
      toast.success(`Marked your tab with ${originalTab.personName} as paid`);
    } catch {
      revert();
      toast.error("An error occurred while updating the tab");
    }
  };

  const handleDelete = async (tabId: number) => {
    const index = tabs.findIndex((tab) => tab.id === tabId);
    const deletedTab = tabs[index];
    if (index === -1 || !deletedTab) return;

    // Optimistically remove; on failure re-insert at the original position.
    setTabs((prevTabs) => prevTabs.filter((tab) => tab.id !== tabId));

    const revert = () =>
      setTabs((prevTabs) => {
        const next = [...prevTabs];
        next.splice(Math.min(index, next.length), 0, deletedTab);
        return next;
      });

    try {
      const result = await deleteTab(tabId);
      if (!result.success) {
        revert();
        toast.error(result.error || "Failed to delete tab");
        return;
      }
      toast.success("Tab deleted");
    } catch {
      revert();
      toast.error("An error occurred while deleting the tab");
    }
  };

  const borrowingTabs = tabs.filter((tab) => tab.status === "borrowing");
  const lendingTabs = tabs.filter((tab) => tab.status === "lending");
  const paidTabs = tabs.filter((tab) => tab.status === "paid");

  const totalBorrowing = borrowingTabs.reduce((sum, tab) => sum + tab.amount, 0);
  const totalLending = lendingTabs.reduce((sum, tab) => sum + tab.amount, 0);
  const net = totalLending - totalBorrowing;

  return (
    <div className="space-y-6">
      <PageHeader
        title="Tabs"
        description="Track money you lend or borrow outside the platform."
        actions={
          <Button onClick={() => openCreate("borrowing")}>
            <Plus />
            Add tab
          </Button>
        }
      />

      <div className="grid gap-4 sm:grid-cols-3">
        <StatCard
          label="You owe"
          value={formatCurrency(totalBorrowing)}
          icon={HandCoins}
        />
        <StatCard
          label="You're owed"
          value={formatCurrency(totalLending)}
          icon={Wallet}
        />
        <StatCard
          label="Net"
          value={formatCurrency(net)}
          icon={Scale}
          hint={
            net === 0
              ? "All square"
              : net > 0
                ? "In your favor"
                : "You owe more than you're owed"
          }
        />
      </div>

      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <TabsList>
          <TabsTrigger value="borrowing" className="gap-1.5">
            Borrowing
            <Badge variant="secondary">{borrowingTabs.length}</Badge>
          </TabsTrigger>
          <TabsTrigger value="lending" className="gap-1.5">
            Lending
            <Badge variant="secondary">{lendingTabs.length}</Badge>
          </TabsTrigger>
          <TabsTrigger value="paid" className="gap-1.5">
            Paid
            <Badge variant="secondary">{paidTabs.length}</Badge>
          </TabsTrigger>
        </TabsList>
        <TabsContent value="borrowing">
          <TabList
            tabs={borrowingTabs}
            emptyTitle="Nothing borrowed"
            emptyDescription="Money you owe someone outside the platform shows up here."
            emptyAction={
              <Button onClick={() => openCreate("borrowing")}>
                <Plus />
                Add a tab
              </Button>
            }
            onMarkPaid={handleMarkPaid}
            onDelete={handleDelete}
          />
        </TabsContent>
        <TabsContent value="lending">
          <TabList
            tabs={lendingTabs}
            emptyTitle="Nothing lent"
            emptyDescription="Money someone owes you outside the platform shows up here."
            emptyAction={
              <Button onClick={() => openCreate("lending")}>
                <Plus />
                Add a tab
              </Button>
            }
            onMarkPaid={handleMarkPaid}
            onDelete={handleDelete}
          />
        </TabsContent>
        <TabsContent value="paid">
          <TabList
            tabs={paidTabs}
            emptyTitle="No paid tabs"
            emptyDescription="Tabs you mark as paid are kept here until you remove them."
            onMarkPaid={handleMarkPaid}
            onDelete={handleDelete}
          />
        </TabsContent>
      </Tabs>

      <CreateTabDialog
        key={createDirection}
        open={createOpen}
        onOpenChange={setCreateOpen}
        defaultDirection={createDirection}
        onCreated={(tab) => setTabs((prevTabs) => [tab, ...prevTabs])}
      />
    </div>
  );
}
